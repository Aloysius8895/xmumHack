"""Typed AWS backend for CareerSphere.

This Lambda is the only public data boundary. Callers can invoke named business
operations; no caller-supplied SQL is accepted. Aurora is accessed through the
RDS Data API, so its cluster can stay private and the Lambda does not need a
public database listener or long-lived AWS credentials.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any


_clients: dict[str, Any] = {}
_cached_secrets: dict[str, str] = {}
_MAX_JOB_BYTES = 700_000
_MAX_PAGE_SIZE = 200
_ALLOWED_SKILLS = frozenset(
    item.strip()
    for item in os.getenv("CAREERSPHERE_SKILL_IDS", "").split(",")
    if item.strip()
)


class ApiError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def _client(name: str):
    if name not in _clients:
        import boto3
        _clients[name] = boto3.client(name, region_name=os.getenv("AWS_REGION"))
    return _clients[name]


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _param(name: str, value: Any, *, json_value: bool = False) -> dict:
    if value is None:
        return {"name": name, "value": {"isNull": True}}
    if json_value:
        return {"name": name, "value": {"stringValue": _json(value), "typeHint": "JSON"}}
    return {"name": name, "value": {"stringValue": str(value)}}


def _db_args() -> dict:
    required = {
        "resourceArn": os.getenv("AURORA_CLUSTER_ARN", ""),
        "secretArn": os.getenv("AURORA_SECRET_ARN", ""),
        "database": os.getenv("AURORA_DATABASE", "careersphere"),
    }
    if not required["resourceArn"] or not required["secretArn"]:
        raise ApiError(503, "database-not-configured")
    return required


def _execute(sql: str, values: dict[str, Any] | None = None, transaction_id: str | None = None) -> dict:
    args = _db_args()
    args.update({"sql": sql, "parameters": [
        _param(name, value, json_value=isinstance(value, (dict, list)))
        for name, value in (values or {}).items()
    ]})
    if transaction_id:
        args["transactionId"] = transaction_id
    return _client("rds-data").execute_statement(**args)


def _rows(sql: str, values: dict[str, Any] | None = None, transaction_id: str | None = None) -> list[dict]:
    response = _execute(sql, values, transaction_id)
    formatted = response.get("formattedRecords")
    if formatted:
        return json.loads(formatted)
    columns = [item["name"] for item in response.get("columnMetadata", [])]
    rows = []
    for record in response.get("records", []):
        rows.append({columns[i]: _field_value(field) for i, field in enumerate(record)})
    return rows


def _field_value(field: dict) -> Any:
    for key in ("stringValue", "longValue", "doubleValue", "booleanValue"):
        if key in field:
            value = field[key]
            if key == "stringValue" and isinstance(value, str) and value[:1] in ("{", "["):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            return value
    return None


def _begin() -> str:
    response = _client("rds-data").begin_transaction(**_db_args())
    return response["transactionId"]


def _commit(transaction_id: str) -> None:
    _client("rds-data").commit_transaction(**_db_args(), transactionId=transaction_id)


def _rollback(transaction_id: str) -> None:
    try:
        _client("rds-data").rollback_transaction(**_db_args(), transactionId=transaction_id)
    except Exception:
        pass


def _secret(secret_arn: str) -> str:
    if not secret_arn:
        raise ApiError(503, "secret-not-configured")
    if secret_arn not in _cached_secrets:
        response = _client("secretsmanager").get_secret_value(SecretId=secret_arn)
        _cached_secrets[secret_arn] = response.get("SecretString", "")
    return _cached_secrets[secret_arn]


def _body(event: dict) -> dict:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw.encode("utf-8")) > 9_500_000:
        raise ApiError(413, "request-too-large")
    try:
        parsed = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ApiError(400, "bad-json") from exc
    if not isinstance(parsed, dict):
        raise ApiError(400, "bad-body")
    return parsed


def _response(status: int, payload: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
        },
        "body": _json(payload),
    }


def _authorise(event: dict) -> None:
    secret_arn = os.getenv("AWS_BACKEND_TOKEN_SECRET_ARN", "")
    expected = _secret(secret_arn) if secret_arn else ""
    headers = {str(key).lower(): value for key, value in (event.get("headers") or {}).items()}
    authorization = str(headers.get("authorization") or "")
    given = re.sub(r"^Bearer\s+", "", authorization, flags=re.IGNORECASE)
    if not expected or not hmac.compare_digest(given.encode(), expected.encode()):
        raise ApiError(401, "unauthorized")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _required_text(value: Any, name: str, limit: int = 1000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ApiError(400, f"bad-{name}")
    return value


def _request_path(event: dict) -> str:
    return event.get("rawPath") or event.get("path") or "/"


def _query(event: dict) -> dict:
    return event.get("queryStringParameters") or {}


def _get_save(player_id: str = "main") -> dict:
    rows = _rows(
        "SELECT player_id, version, state FROM game_saves WHERE player_id = :player_id",
        {"player_id": player_id},
    )
    if not rows:
        return {"playerId": player_id, "version": 0, "state": None}
    return {"playerId": player_id, "version": int(rows[0]["version"]), "state": rows[0]["state"]}


def _commit_save(body: dict) -> dict:
    player_id = _required_text(body.get("playerId", "main"), "player-id", 80)
    expected = body.get("expectedVersion")
    state = body.get("state")
    if not isinstance(expected, int) or expected < 0 or not isinstance(state, dict):
        raise ApiError(400, "bad-save")

    operation = body.get("operation", "save")
    if operation not in ("save", "chat", "digest"):
        raise ApiError(400, "bad-operation")
    meta = body.get("metadata") or {}
    if not isinstance(meta, dict):
        raise ApiError(400, "bad-metadata")
    idempotency_key = str(meta.get("idempotencyKey") or "")
    fingerprint = str(meta.get("fingerprint") or "")
    if operation in ("chat", "digest") and (not idempotency_key or not fingerprint):
        raise ApiError(400, "bad-idempotency")

    tx = _begin()
    try:
        if idempotency_key:
            previous = _rows(
                "SELECT fingerprint, response FROM api_idempotency "
                "WHERE idempotency_key = :key FOR UPDATE",
                {"key": idempotency_key},
                tx,
            )
            if previous:
                if previous[0]["fingerprint"] != fingerprint:
                    raise ApiError(409, "idempotency-conflict")
                _commit(tx)
                return {**previous[0]["response"], "duplicate": True}

        digest_data = meta.get("digest") if operation == "digest" else None
        if digest_data:
            date = _required_text(digest_data.get("date"), "digest-date", 10)
            existing = _rows(
                "SELECT digest_date, summary, skills, summary_only FROM daily_digests "
                "WHERE digest_date = CAST(:digest_date AS date) FOR UPDATE",
                {"digest_date": date},
                tx,
            )
            if existing:
                result = {
                    "digest": {
                        "date": str(existing[0]["digest_date"])[:10],
                        "summary": existing[0]["summary"],
                        "skills": existing[0]["skills"],
                    },
                    "duplicate": True,
                }
                _execute(
                    "INSERT INTO api_idempotency (idempotency_key, fingerprint, response) "
                    "VALUES (:key, :fingerprint, :response)",
                    {"key": idempotency_key, "fingerprint": fingerprint, "response": result},
                    tx,
                )
                _commit(tx)
                return result

        current = _rows(
            "SELECT version FROM game_saves WHERE player_id = :player_id FOR UPDATE",
            {"player_id": player_id},
            tx,
        )
        actual = int(current[0]["version"]) if current else 0
        if actual != expected:
            raise ApiError(409, "save-version-conflict")
        next_version = actual + 1
        if current:
            _execute(
                "UPDATE game_saves SET version = :version, state = CAST(:state AS jsonb), "
                "updated_at = now() WHERE player_id = :player_id",
                {"version": next_version, "state": state, "player_id": player_id},
                tx,
            )
        else:
            _execute(
                "INSERT INTO game_saves (player_id, version, state) "
                "VALUES (:player_id, :version, CAST(:state AS jsonb))",
                {"player_id": player_id, "version": next_version, "state": state},
                tx,
            )

        result = {"result": meta.get("result") or {}, "version": next_version}
        if operation == "chat":
            report = meta.get("report")
            if isinstance(report, dict) and report.get("log"):
                log = report["log"]
                if log.get("verdict", "learned") == "learned":
                    event_id = str(report.get("eventId") or idempotency_key)
                    _execute(
                        "INSERT INTO learning_reports "
                        "(id, event_id, user_id, report_date, text, summary, skill_ids, advanced, points, created_at) "
                        "VALUES (:id, :event_id, :user_id, CAST(:report_date AS date), :text, :summary, "
                        "CAST(:skill_ids AS jsonb), CAST(:advanced AS jsonb), :points, now()) "
                        "ON CONFLICT (event_id) DO NOTHING",
                        {
                            "id": str(uuid.uuid4()), "event_id": event_id,
                            "user_id": str(report.get("userId") or "unknown")[:200],
                            "report_date": str(report.get("date") or _now()[:10]),
                            "text": str(report.get("text") or "")[:2000],
                            "summary": str(log.get("summary") or "")[:2000],
                            "skill_ids": log.get("skillIds") or [],
                            "advanced": log.get("advanced") or [],
                            "points": log.get("points"),
                        },
                        tx,
                    )
        elif operation == "digest" and digest_data:
            skills = digest_data.get("skills") or []
            if digest_data.get("summaryOnly") is True:
                skills = []
            _execute(
                "INSERT INTO daily_digests (digest_date, summary, skills, summary_only) "
                "VALUES (CAST(:digest_date AS date), :summary, CAST(:skills AS jsonb), :summary_only)",
                {
                    "digest_date": str(digest_data.get("date")),
                    "summary": str(digest_data.get("summary") or "")[:1000],
                    "skills": skills,
                    "summary_only": digest_data.get("summaryOnly") is True,
                },
                tx,
            )

        _execute(
            "INSERT INTO api_idempotency (idempotency_key, fingerprint, response) "
            "VALUES (:key, :fingerprint, :response)",
            {"key": idempotency_key, "fingerprint": fingerprint, "response": result},
            tx,
        ) if idempotency_key else None
        _commit(tx)
        return result
    except ApiError:
        _rollback(tx)
        raise
    except Exception:
        _rollback(tx)
        raise


def _document(document_id: str) -> dict:
    if document_id not in ("market", "trends"):
        raise ApiError(404, "not-found")
    rows = _rows(
        "SELECT version, payload FROM app_documents WHERE document_id = :document_id",
        {"document_id": document_id},
    )
    if not rows:
        return {"documentId": document_id, "version": 0, "payload": None}
    return {"documentId": document_id, "version": int(rows[0]["version"]), "payload": rows[0]["payload"]}


def _put_document(body: dict) -> dict:
    document_id = _required_text(body.get("documentId"), "document-id", 20)
    if document_id not in ("market", "trends"):
        raise ApiError(404, "not-found")
    expected = body.get("expectedVersion")
    payload = body.get("payload")
    if not isinstance(expected, int) or expected < 0 or not isinstance(payload, dict):
        raise ApiError(400, "bad-document")
    tx = _begin()
    try:
        existing = _rows(
            "SELECT version FROM app_documents WHERE document_id = :document_id FOR UPDATE",
            {"document_id": document_id},
            tx,
        )
        actual = int(existing[0]["version"]) if existing else 0
        if actual != expected:
            raise ApiError(409, "document-version-conflict")
        next_version = actual + 1
        if existing:
            _execute(
                "UPDATE app_documents SET version = :version, payload = CAST(:payload AS jsonb), updated_at = now() "
                "WHERE document_id = :document_id",
                {"version": next_version, "payload": payload, "document_id": document_id},
                tx,
            )
        else:
            _execute(
                "INSERT INTO app_documents (document_id, version, payload) "
                "VALUES (:document_id, :version, CAST(:payload AS jsonb))",
                {"document_id": document_id, "version": next_version, "payload": payload},
                tx,
            )
        _commit(tx)
        return {"documentId": document_id, "version": next_version}
    except Exception:
        _rollback(tx)
        raise


def _chat_operation(method: str, path: str, event: dict, body: dict) -> dict:
    query = _query(event)
    if method == "POST" and path == "/v1/chat/seen":
        message_id = _required_text(body.get("messageId"), "message-id", 300)
        rows = _rows(
            "INSERT INTO seen_messages (message_id) VALUES (:message_id) "
            "ON CONFLICT (message_id) DO NOTHING RETURNING message_id",
            {"message_id": message_id},
        )
        return {"seen": bool(rows)}
    if method == "DELETE" and path.startswith("/v1/chat/seen/"):
        message_id = path.removeprefix("/v1/chat/seen/")
        _execute("DELETE FROM seen_messages WHERE message_id = :message_id", {"message_id": message_id})
        return {"released": True}
    if method == "POST" and path == "/v1/chat/messages":
        user_id = _required_text(body.get("userId"), "user-id", 200)
        role = body.get("role")
        content = _required_text(body.get("content"), "content", 20_000)
        if role not in ("user", "assistant"):
            raise ApiError(400, "bad-role")
        _execute(
            "INSERT INTO chat_messages (id, user_id, role, content, created_at) "
            "VALUES (:id, :user_id, :role, :content, CAST(:created_at AS timestamptz))",
            {
                "id": str(body.get("id") or uuid.uuid4()), "user_id": user_id,
                "role": role, "content": content, "created_at": str(body.get("createdAt") or _now()),
            },
        )
        return {"saved": True}
    if method == "GET" and path == "/v1/chat/messages":
        user_id = _required_text(query.get("userId"), "user-id", 200)
        try:
            limit = max(1, min(int(query.get("limit", "20")), _MAX_PAGE_SIZE))
        except ValueError as exc:
            raise ApiError(400, "bad-limit") from exc
        return {"messages": _rows(
            "SELECT role, content FROM chat_messages WHERE user_id = :user_id "
            "ORDER BY created_at DESC, id DESC LIMIT :limit",
            {"user_id": user_id, "limit": limit},
        )[::-1]}
    if method == "DELETE" and path == "/v1/chat/history":
        user_id = _required_text(query.get("userId"), "user-id", 200)
        _execute("DELETE FROM chat_messages WHERE user_id = :user_id", {"user_id": user_id})
        return {"cleared": True}
    if method == "POST" and path == "/v1/chat/reports":
        user_id = _required_text(body.get("userId"), "user-id", 200)
        event_id = body.get("eventId")
        _execute(
            "INSERT INTO learning_reports "
            "(id, event_id, user_id, report_date, text, summary, skill_ids, advanced, points, created_at) "
            "VALUES (:id, :event_id, :user_id, CAST(:report_date AS date), :text, :summary, "
            "CAST(:skill_ids AS jsonb), CAST(:advanced AS jsonb), :points, CAST(:created_at AS timestamptz)) "
            "ON CONFLICT (event_id) DO NOTHING",
            {
                "id": str(uuid.uuid4()), "event_id": event_id,
                "user_id": user_id, "report_date": _required_text(body.get("date"), "date", 10),
                "text": _required_text(body.get("text"), "text", 2000),
                "summary": body.get("summary"),
                "skill_ids": body.get("skillIds") or [], "advanced": body.get("advanced") or [],
                "points": body.get("points"), "created_at": str(body.get("createdAt") or _now()),
            },
        )
        return {"saved": True}
    if method == "GET" and path == "/v1/chat/reports":
        report_date = _required_text(query.get("date"), "date", 10)
        rows = _rows(
            "SELECT user_id AS wa_id, text, summary, skill_ids, advanced, points "
            "FROM learning_reports WHERE report_date = CAST(:report_date AS date) ORDER BY created_at, id",
            {"report_date": report_date},
        )
        return {"reports": rows}
    if method == "PUT" and path == "/v1/chat/pending":
        user_id = _required_text(body.get("userId"), "user-id", 200)
        _execute(
            "INSERT INTO pending_confirmations (user_id, text, lang, created_at) "
            "VALUES (:user_id, :text, :lang, CAST(:created_at AS timestamptz)) "
            "ON CONFLICT (user_id) DO UPDATE SET text = EXCLUDED.text, lang = EXCLUDED.lang, created_at = EXCLUDED.created_at",
            {
                "user_id": user_id, "text": _required_text(body.get("text"), "text", 2000),
                "lang": _required_text(body.get("lang"), "lang", 10),
                "created_at": str(body.get("createdAt") or _now()),
            },
        )
        return {"saved": True}
    if method == "POST" and path == "/v1/chat/pending/pop":
        user_id = _required_text(body.get("userId"), "user-id", 200)
        tx = _begin()
        try:
            rows = _rows(
                "DELETE FROM pending_confirmations WHERE user_id = :user_id "
                "RETURNING text, lang",
                {"user_id": user_id},
                tx,
            )
            _commit(tx)
            return {"pending": rows[0] if rows else None}
        except Exception:
            _rollback(tx)
            raise
    raise ApiError(404, "not-found")


def _ai_start(body: dict) -> dict:
    request_bytes = len(_json(body).encode("utf-8"))
    if request_bytes > _MAX_JOB_BYTES:
        raise ApiError(413, "ai-input-too-large")
    provider = body.get("provider") or os.getenv("DEFAULT_AI_PROVIDER", "bedrock")
    if provider not in ("bedrock", "deepseek_direct"):
        raise ApiError(400, "bad-ai-provider")
    if provider == "deepseek_direct" and os.getenv("ALLOW_DEEPSEEK_DIRECT", "false").lower() != "true":
        raise ApiError(403, "deepseek-direct-disabled")
    mode = body.get("mode")
    if mode not in ("text", "json"):
        raise ApiError(400, "bad-ai-mode")
    messages = body.get("messages")
    if mode == "text" and (
        not isinstance(messages, list) or not messages or
        any(not isinstance(m, dict) or m.get("role") not in ("user", "assistant") or not isinstance(m.get("content"), str)
            for m in messages)
    ):
        raise ApiError(400, "bad-ai-messages")
    if mode == "json" and (not isinstance(body.get("content"), str) or not isinstance(body.get("schema"), dict)):
        raise ApiError(400, "bad-ai-schema")
    if provider == "bedrock" and not (os.getenv("BEDROCK_REGION") and os.getenv("BEDROCK_MODEL_ID")):
        raise ApiError(503, "bedrock-not-configured")
    if provider == "deepseek_direct" and not (os.getenv("DEEPSEEK_SECRET_ARN") and os.getenv("DEEPSEEK_MODEL_ID")):
        raise ApiError(503, "deepseek-direct-not-configured")

    job_id = str(uuid.uuid4())
    request = {**body, "provider": provider}
    _execute(
        "INSERT INTO ai_jobs (id, status, request) VALUES (:id, 'queued', CAST(:request AS jsonb))",
        {"id": job_id, "request": request},
    )
    try:
        _client("lambda").invoke(
            FunctionName=os.environ["AI_WORKER_FUNCTION_ARN"],
            InvocationType="Event",
            Payload=_json({"jobId": job_id}).encode("utf-8"),
        )
    except Exception:
        _execute(
            "UPDATE ai_jobs SET status = 'failed', error_code = 'ai-worker-unavailable', updated_at = now() "
            "WHERE id = :id",
            {"id": job_id},
        )
        raise ApiError(503, "ai-worker-unavailable")
    return {"jobId": job_id, "status": "queued", "provider": provider}


def _ai_job(job_id: str) -> tuple[int, dict]:
    rows = _rows(
        "SELECT status, result, error_code FROM ai_jobs WHERE id = :id",
        {"id": job_id},
    )
    if not rows:
        raise ApiError(404, "ai-job-not-found")
    row = rows[0]
    if row["status"] in ("queued", "running"):
        return 202, {"jobId": job_id, "status": row["status"]}
    if row["status"] == "failed":
        return 502, {"jobId": job_id, "status": "failed", "error": row.get("error_code") or "ai-error"}
    return 200, {"jobId": job_id, "status": "succeeded", **(row.get("result") or {})}


def _route(method: str, path: str, event: dict, body: dict) -> tuple[int, dict]:
    if method == "GET" and path == "/v1/health":
        _db_args()
        return 200, {"ok": True, "region": os.getenv("AWS_REGION", "unknown")}
    if method == "GET" and path == "/v1/game/save":
        return 200, _get_save((_query(event).get("playerId") or "main"))
    if method == "POST" and path == "/v1/game/save/commit":
        return 200, _commit_save(body)
    if method == "GET" and path.startswith("/v1/documents/"):
        return 200, _document(path.removeprefix("/v1/documents/"))
    if method == "PUT" and path == "/v1/documents":
        return 200, _put_document(body)
    if path.startswith("/v1/chat/"):
        return 200, _chat_operation(method, path, event, body)
    if method == "POST" and path == "/v1/ai/jobs":
        return 202, _ai_start(body)
    match = re.fullmatch(r"/v1/ai/jobs/([0-9a-f-]{36})", path)
    if method == "GET" and match:
        return _ai_job(match.group(1))
    raise ApiError(404, "not-found")


def handler(event: dict, _context: Any) -> dict:
    try:
        _authorise(event)
        method = (
            (event.get("requestContext", {}).get("http") or {}).get("method")
            or event.get("httpMethod")
            or "GET"
        ).upper()
        path = _request_path(event)
        status, payload = _route(method, path, event, _body(event))
        return _response(status, payload)
    except ApiError as exc:
        return _response(exc.status, {"error": exc.code})
    except Exception as exc:
        code = _aws_error_code(exc)
        print(json.dumps({"event": "backend-error", "code": code, "type": type(exc).__name__}))
        return _response(502 if code.startswith("ai-") else 500, {"error": code})


def _aws_error_code(exc: Exception) -> str:
    code = ""
    response = getattr(exc, "response", None)
    if isinstance(response, dict):
        code = str(response.get("Error", {}).get("Code", ""))
    text = (code + " " + str(exc)).lower()
    if "throttl" in text or "too many requests" in text or "servicequota" in text:
        return "ai-busy"
    if "accessdenied" in text or "unauthorized" in text or "forbidden" in text:
        return "ai-auth"
    if "timeout" in text or "timed out" in text:
        return "ai-timeout"
    if "model" in text and ("not found" in text or "invalid" in text or "not supported" in text):
        return "ai-model-unavailable"
    if "validation" in text or "invalid" in text:
        return "ai-request-invalid"
    return "backend-error"


def ai_worker(event: dict, _context: Any) -> None:
    job_id = event.get("jobId")
    if not isinstance(job_id, str):
        raise ValueError("jobId is required")
    _execute(
        "UPDATE ai_jobs SET status = 'running', updated_at = now() WHERE id = :id AND status = 'queued'",
        {"id": job_id},
    )
    rows = _rows("SELECT request FROM ai_jobs WHERE id = :id", {"id": job_id})
    if not rows:
        return
    request = rows[0]["request"]
    try:
        result = _complete_ai(request)
        _execute(
            "UPDATE ai_jobs SET status = 'succeeded', result = CAST(:result AS jsonb), updated_at = now() "
            "WHERE id = :id",
            {"id": job_id, "result": result},
        )
    except Exception as exc:
        code = _aws_error_code(exc)
        print(json.dumps({"event": "ai-job-failed", "jobId": job_id, "code": code}))
        _execute(
            "UPDATE ai_jobs SET status = 'failed', error_code = :code, updated_at = now() WHERE id = :id",
            {"id": job_id, "code": code},
        )


def _complete_ai(request: dict) -> dict:
    provider = request.get("provider")
    if provider == "bedrock":
        return _bedrock_complete(request)
    if provider == "deepseek_direct":
        return _deepseek_complete(request)
    raise ApiError(400, "bad-ai-provider")


def _bedrock_complete(request: dict) -> dict:
    region = os.getenv("BEDROCK_REGION")
    model_id = os.getenv("BEDROCK_MODEL_ID")
    if not region or not model_id:
        raise ApiError(503, "bedrock-not-configured")
    client = _client("bedrock-runtime")
    mode = request["mode"]
    messages = request.get("messages") if mode == "text" else [
        {"role": "user", "content": [{"text": request.get("content", "")}]}
    ]
    if mode == "text":
        for message in messages:
            if not isinstance(message.get("content"), str):
                raise ApiError(400, "bedrock-text-only")
            message["content"] = [{"text": message["content"]}]
    args = {
        "modelId": model_id,
        "messages": messages,
        "inferenceConfig": {"maxTokens": max(1, min(int(request.get("maxTokens", 1200)), 8000))},
    }
    system = request.get("system")
    if isinstance(system, str) and system:
        args["system"] = [{"text": system[:50_000]}]
    if mode == "json":
        args["toolConfig"] = {
            "tools": [{
                "toolSpec": {
                    "name": "submit_result",
                    "description": "Submit the structured result matching the provided schema.",
                    "inputSchema": {"json": request["schema"]},
                }
            }],
            "toolChoice": {"tool": {"name": "submit_result"}},
        }
    response = client.converse(**args)
    content = response.get("output", {}).get("message", {}).get("content", [])
    if mode == "json":
        for block in content:
            if "toolUse" in block and block["toolUse"].get("name") == "submit_result":
                return {"value": block["toolUse"].get("input")}
        raise ApiError(502, "ai-structured-output-missing")
    text = "".join(block.get("text", "") for block in content if "text" in block).strip()
    if not text:
        raise ApiError(502, "ai-empty-response")
    return {"text": text}


def _deepseek_complete(request: dict) -> dict:
    if os.getenv("ALLOW_DEEPSEEK_DIRECT", "false").lower() != "true":
        raise ApiError(403, "deepseek-direct-disabled")
    model = os.getenv("DEEPSEEK_MODEL_ID", "")
    if not model:
        raise ApiError(503, "deepseek-direct-not-configured")
    raw_secret = _secret(os.getenv("DEEPSEEK_SECRET_ARN", ""))
    try:
        api_key = json.loads(raw_secret)["DEEPSEEK_API_KEY"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ApiError(503, "deepseek-secret-invalid") from exc

    if request["mode"] == "text":
        messages = list(request["messages"])
    else:
        messages = [{"role": "user", "content": request["content"]}]
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": max(1, min(int(request.get("maxTokens", 1200)), 8000)),
        "messages": ([{"role": "system", "content": request["system"]}] if request.get("system") else []) + messages,
    }
    if request["mode"] == "json":
        payload["tools"] = [{
            "name": "submit_result",
            "description": "Submit the structured result matching the provided schema.",
            "input_schema": request["schema"],
        }]
        payload["tool_choice"] = {"type": "tool", "name": "submit_result"}
    req = urllib.request.Request(
        "https://api.deepseek.com/anthropic/v1/messages",
        data=_json(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=240) as response:
            answer = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise ApiError(503, "ai-busy") from exc
        if exc.code in (401, 403):
            raise ApiError(503, "ai-auth") from exc
        raise ApiError(502, "ai-upstream-error") from exc
    content = answer.get("content", [])
    if request["mode"] == "json":
        for block in content:
            if block.get("type") == "tool_use" and block.get("name") == "submit_result":
                return {"value": block.get("input")}
        raise ApiError(502, "ai-structured-output-missing")
    text = "".join(block.get("text", "") for block in content if block.get("type") == "text").strip()
    if not text:
        raise ApiError(502, "ai-empty-response")
    return {"text": text}


def schema_handler(event: dict, context: Any) -> dict:
    """CloudFormation custom-resource provider; applies the reviewed schema once."""
    request_type = event.get("RequestType")
    physical_id = event.get("PhysicalResourceId") or "careersphere-schema-v1"
    status = "SUCCESS"
    reason = "schema is current"
    try:
        if request_type in ("Create", "Update"):
            path = os.path.join(os.path.dirname(__file__), "schema.sql")
            with open(path, encoding="utf-8") as schema_file:
                statements = [s.strip() for s in schema_file.read().split(";") if s.strip()]
            for statement in statements:
                _execute(statement)
    except Exception as exc:
        status = "FAILED"
        reason = f"schema apply failed ({type(exc).__name__})"
        print(json.dumps({"event": "schema-apply-failed", "type": type(exc).__name__}))
    _send_cfn_response(event, context, status, reason, physical_id)
    return {"status": status}


def _send_cfn_response(event: dict, context: Any, status: str, reason: str, physical_id: str) -> None:
    url = event.get("ResponseURL")
    if not url:
        return
    payload = {
        "Status": status,
        "Reason": reason[:400],
        "PhysicalResourceId": physical_id,
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "NoEcho": True,
        "Data": {},
    }
    request = urllib.request.Request(
        url, data=_json(payload).encode("utf-8"), method="PUT",
        headers={"content-type": "", "content-length": str(len(_json(payload).encode("utf-8")))},
    )
    try:
        urllib.request.urlopen(request, timeout=5).read()
    except Exception as exc:
        print(json.dumps({"event": "cfn-response-failed", "type": type(exc).__name__}))


def migration_handler(event: dict, _context: Any) -> dict:
    """Privileged direct-invoke importer. It is intentionally not an API route."""
    mode = event.get("mode")
    if mode not in ("dry-run", "import", "rollback"):
        raise ValueError("mode must be dry-run, import, or rollback")
    if mode == "rollback":
        return _rollback_import(event)
    bucket = _required_text(event.get("bucket"), "bucket", 255)
    key = _required_text(event.get("key"), "key", 1024)
    obj = _client("s3").get_object(Bucket=bucket, Key=key)
    bundle_bytes = obj["Body"].read(8_000_001)
    if len(bundle_bytes) > 8_000_000:
        raise ValueError("migration bundle exceeds the 8 MB Lambda migration limit")
    bundle_hash = hashlib.sha256(bundle_bytes).hexdigest()
    expected_hash = event.get("bundleSha256")
    if expected_hash and not hmac.compare_digest(str(expected_hash), bundle_hash):
        raise ValueError("bundle SHA-256 does not match bundleSha256")
    try:
        bundle = json.loads(bundle_bytes)
        counts = _validate_bundle(bundle)
    except (json.JSONDecodeError, TypeError, KeyError, ValueError) as exc:
        raise ValueError(f"invalid migration bundle: {type(exc).__name__}") from exc
    if mode == "dry-run":
        return {"mode": mode, "bundleSha256": bundle_hash, "counts": counts, "target": _target_counts()}
    return _import_bundle(bundle, bundle_hash, counts)


def _validate_bundle(bundle: dict) -> dict:
    if not isinstance(bundle, dict) or bundle.get("formatVersion") != 1:
        raise ValueError("unsupported formatVersion")
    game = bundle.get("game") or {}
    bot = bundle.get("chatbot") or {}
    if not isinstance(game.get("save"), dict):
        raise ValueError("game.save must be an object")
    if not isinstance(bot, dict):
        raise ValueError("chatbot must be an object")
    list_names = ("messages", "seenMessages", "reports", "reportEvents", "pendingConfirmations")
    for name in list_names:
        if not isinstance(bot.get(name, []), list):
            raise ValueError(f"chatbot.{name} must be an array")
    return {
        "saves": 1,
        "documents": sum(isinstance(game.get(name), dict) for name in ("market", "trends")),
        "messages": len(bot.get("messages", [])),
        "seenMessages": len(bot.get("seenMessages", [])),
        "reports": len(bot.get("reports", [])),
        "reportEvents": len(bot.get("reportEvents", [])),
        "pendingConfirmations": len(bot.get("pendingConfirmations", [])),
        "digests": len(game["save"].get("digests", [])),
    }


def _target_counts() -> dict:
    tables = ("game_saves", "app_documents", "chat_messages", "seen_messages", "learning_reports",
              "pending_confirmations", "daily_digests", "api_idempotency")
    return {table: int(_rows(f"SELECT count(*) AS count FROM {table}")[0]["count"]) for table in tables}


def _import_bundle(bundle: dict, bundle_hash: str, counts: dict) -> dict:
    tx = _begin()
    try:
        _execute("SELECT pg_advisory_xact_lock(hashtext('careersphere-legacy-import-v1'))", transaction_id=tx)
        existing = _rows(
            "SELECT status, counts FROM migration_runs WHERE bundle_sha256 = :hash FOR UPDATE",
            {"hash": bundle_hash}, tx,
        )
        if existing and existing[0]["status"] == "succeeded":
            _commit(tx)
            return {"mode": "import", "bundleSha256": bundle_hash, "duplicate": True, "counts": existing[0]["counts"]}
        occupied = _rows(
            "SELECT (SELECT count(*) FROM game_saves) + (SELECT count(*) FROM app_documents) + "
            "(SELECT count(*) FROM chat_messages) + (SELECT count(*) FROM seen_messages) + "
            "(SELECT count(*) FROM learning_reports) + (SELECT count(*) FROM daily_digests) AS count",
            transaction_id=tx,
        )[0]["count"]
        if int(occupied) > 0:
            raise ApiError(409, "migration-target-not-empty")

        _execute(
            "INSERT INTO migration_runs (bundle_sha256, status, counts) VALUES (:hash, 'running', CAST(:counts AS jsonb)) "
            "ON CONFLICT (bundle_sha256) DO UPDATE SET status = 'running', started_at = now(), finished_at = NULL, "
            "counts = EXCLUDED.counts, error_code = NULL",
            {"hash": bundle_hash, "counts": counts}, tx,
        )
        snapshot = _snapshot(tx)
        _execute(
            "INSERT INTO migration_backups (bundle_sha256, snapshot) VALUES (:hash, CAST(:snapshot AS jsonb)) "
            "ON CONFLICT (bundle_sha256) DO UPDATE SET snapshot = EXCLUDED.snapshot, created_at = now()",
            {"hash": bundle_hash, "snapshot": snapshot}, tx,
        )
        _insert_bundle(bundle, bundle_hash, tx)
        _execute(
            "UPDATE migration_runs SET status = 'succeeded', finished_at = now() WHERE bundle_sha256 = :hash",
            {"hash": bundle_hash}, tx,
        )
        _commit(tx)
        return {"mode": "import", "bundleSha256": bundle_hash, "counts": counts, "status": "succeeded"}
    except Exception as exc:
        _rollback(tx)
        try:
            _execute(
                "INSERT INTO migration_runs (bundle_sha256, status, finished_at, error_code) "
                "VALUES (:hash, 'failed', now(), :code) ON CONFLICT (bundle_sha256) DO UPDATE "
                "SET status = 'failed', finished_at = now(), error_code = EXCLUDED.error_code",
                {"hash": bundle_hash, "code": "migration-failed"},
            )
        except Exception:
            pass
        if isinstance(exc, ApiError):
            raise
        raise


def _snapshot(tx: str) -> dict:
    snapshot = {}
    for table in ("game_saves", "app_documents", "chat_messages", "seen_messages",
                  "learning_reports", "pending_confirmations", "daily_digests", "api_idempotency"):
        snapshot[table] = _rows(f"SELECT * FROM {table}", transaction_id=tx)
    return snapshot


def _insert_bundle(bundle: dict, bundle_hash: str, tx: str) -> None:
    game = bundle["game"]
    _execute(
        "INSERT INTO game_saves (player_id, version, state) VALUES ('main', 1, CAST(:state AS jsonb))",
        {"state": game["save"]}, tx,
    )
    for name in ("market", "trends"):
        payload = game.get(name)
        if isinstance(payload, dict):
            _execute(
                "INSERT INTO app_documents (document_id, version, payload) "
                "VALUES (:document_id, 1, CAST(:payload AS jsonb))",
                {"document_id": name, "payload": payload}, tx,
            )
    for item in game["save"].get("digests", []):
        _execute(
            "INSERT INTO daily_digests (digest_date, summary, skills, summary_only, source) "
            "VALUES (CAST(:date AS date), :summary, CAST(:skills AS jsonb), :summary_only, 'legacy-import') "
            "ON CONFLICT (digest_date) DO NOTHING",
            {
                "date": item["date"], "summary": str(item.get("summary") or "")[:1000],
                "skills": item.get("skills") or [], "summary_only": not bool(item.get("skills")),
            }, tx,
        )
    bot = bundle.get("chatbot") or {}
    for row in bot.get("messages", []):
        _execute(
            "INSERT INTO chat_messages (id, user_id, role, content, created_at) "
            "VALUES (:id, :user_id, :role, :content, CAST(:created_at AS timestamptz))",
            {
                "id": str(row["id"]), "user_id": str(row["userId"]), "role": row["role"],
                "content": str(row["content"]), "created_at": str(row["createdAt"]),
            }, tx,
        )
    for row in bot.get("seenMessages", []):
        _execute(
            "INSERT INTO seen_messages (message_id, seen_at) VALUES (:message_id, CAST(:seen_at AS timestamptz))",
            {"message_id": str(row["messageId"]), "seen_at": str(row["seenAt"])}, tx,
        )
    for row in bot.get("reports", []):
        _execute(
            "INSERT INTO learning_reports "
            "(id, event_id, user_id, report_date, text, summary, skill_ids, advanced, points, created_at) "
            "VALUES (:id, :event_id, :user_id, CAST(:report_date AS date), :text, :summary, "
            "CAST(:skill_ids AS jsonb), CAST(:advanced AS jsonb), :points, CAST(:created_at AS timestamptz))",
            {
                "id": str(row["id"]), "event_id": row.get("eventId"), "user_id": str(row["userId"]),
                "report_date": str(row["date"]), "text": str(row["text"]), "summary": row.get("summary"),
                "skill_ids": row.get("skillIds") or [], "advanced": row.get("advanced") or [],
                "points": row.get("points"), "created_at": str(row["createdAt"]),
            }, tx,
        )
    for row in bot.get("reportEvents", []):
        _execute(
            "INSERT INTO api_idempotency (idempotency_key, fingerprint, response) "
            "VALUES (:key, :fingerprint, '{}'::jsonb) ON CONFLICT DO NOTHING",
            {"key": "legacy:" + str(row["eventId"]), "fingerprint": "legacy:" + bundle_hash},
            tx,
        )
    for row in bot.get("pendingConfirmations", []):
        _execute(
            "INSERT INTO pending_confirmations (user_id, text, lang, created_at) "
            "VALUES (:user_id, :text, :lang, CAST(:created_at AS timestamptz))",
            {
                "user_id": str(row["userId"]), "text": str(row["text"]),
                "lang": str(row["lang"]), "created_at": str(row["createdAt"]),
            }, tx,
        )


def _rollback_import(event: dict) -> dict:
    bundle_hash = _required_text(event.get("bundleSha256"), "bundle-sha256", 64)
    if not re.fullmatch(r"[0-9a-f]{64}", bundle_hash):
        raise ValueError("bundleSha256 must be a lowercase SHA-256 hex string")
    if event.get("confirmRollback") is not True:
        raise ValueError("set confirmRollback=true after reviewing rollback consequences")
    tx = _begin()
    try:
        _execute("SELECT pg_advisory_xact_lock(hashtext('careersphere-legacy-import-v1'))", transaction_id=tx)
        run = _rows(
            "SELECT status, finished_at FROM migration_runs WHERE bundle_sha256 = :hash FOR UPDATE",
            {"hash": bundle_hash}, tx,
        )
        backup = _rows(
            "SELECT snapshot, created_at FROM migration_backups WHERE bundle_sha256 = :hash FOR UPDATE",
            {"hash": bundle_hash}, tx,
        )
        if not run or run[0]["status"] != "succeeded" or not backup:
            raise ApiError(404, "migration-backup-not-found")
        imported_at = run[0]["finished_at"]
        checks = (
            ("game_saves", "updated_at"), ("app_documents", "updated_at"),
            ("chat_messages", "created_at"), ("seen_messages", "seen_at"),
            ("learning_reports", "created_at"), ("daily_digests", "created_at"),
            ("pending_confirmations", "created_at"),
        )
        for table, column in checks:
            newer = _rows(
                f"SELECT count(*) AS count FROM {table} WHERE {column} > CAST(:imported_at AS timestamptz)",
                {"imported_at": imported_at}, tx,
            )[0]["count"]
            if int(newer) > 0:
                raise ApiError(409, "rollback-blocked-by-new-data")

        snapshot = backup[0]["snapshot"]
        tables = ("game_saves", "app_documents", "chat_messages", "seen_messages",
                  "learning_reports", "pending_confirmations", "daily_digests", "api_idempotency")
        for table in tables:
            _execute(f"DELETE FROM {table}", transaction_id=tx)
        _restore_snapshot(snapshot, tx)
        _execute(
            "UPDATE migration_runs SET status = 'rolled_back', finished_at = now() WHERE bundle_sha256 = :hash",
            {"hash": bundle_hash}, tx,
        )
        _commit(tx)
        return {"mode": "rollback", "bundleSha256": bundle_hash, "status": "rolled_back"}
    except Exception:
        _rollback(tx)
        raise


def _restore_snapshot(snapshot: dict, tx: str) -> None:
    # Rollback normally restores empty target tables, but this makes recovery
    # correct if an operator reused the importer against a deliberately seeded DB.
    for row in snapshot.get("game_saves", []):
        _execute(
            "INSERT INTO game_saves (player_id, version, state, updated_at) "
            "VALUES (:player_id, :version, CAST(:state AS jsonb), CAST(:updated_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("app_documents", []):
        _execute(
            "INSERT INTO app_documents (document_id, version, payload, updated_at) "
            "VALUES (:document_id, :version, CAST(:payload AS jsonb), CAST(:updated_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("chat_messages", []):
        _execute(
            "INSERT INTO chat_messages (id, user_id, role, content, created_at) "
            "VALUES (:id, :user_id, :role, :content, CAST(:created_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("seen_messages", []):
        _execute(
            "INSERT INTO seen_messages (message_id, seen_at) VALUES (:message_id, CAST(:seen_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("learning_reports", []):
        _execute(
            "INSERT INTO learning_reports "
            "(id, event_id, user_id, report_date, text, summary, skill_ids, advanced, points, created_at) "
            "VALUES (:id, :event_id, :user_id, CAST(:report_date AS date), :text, :summary, "
            "CAST(:skill_ids AS jsonb), CAST(:advanced AS jsonb), :points, CAST(:created_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("pending_confirmations", []):
        _execute(
            "INSERT INTO pending_confirmations (user_id, text, lang, created_at) "
            "VALUES (:user_id, :text, :lang, CAST(:created_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("daily_digests", []):
        _execute(
            "INSERT INTO daily_digests (digest_date, summary, skills, summary_only, source, created_at) "
            "VALUES (CAST(:digest_date AS date), :summary, CAST(:skills AS jsonb), :summary_only, :source, "
            "CAST(:created_at AS timestamptz))",
            row, tx,
        )
    for row in snapshot.get("api_idempotency", []):
        _execute(
            "INSERT INTO api_idempotency (idempotency_key, fingerprint, response, created_at) "
            "VALUES (:idempotency_key, :fingerprint, CAST(:response AS jsonb), CAST(:created_at AS timestamptz))",
            row, tx,
        )
