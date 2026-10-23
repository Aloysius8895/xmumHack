import importlib
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

LAMBDA_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAMBDA_DIR))
backend = importlib.import_module("app")


def valid_bundle():
    return {
        "formatVersion": 1,
        "game": {
            "save": {"version": 4, "digests": []},
            "market": {"history": []},
            "trends": {"months": []},
        },
        "chatbot": {
            "messages": [{
                "id": "legacy-message:1", "userId": "tg:1", "role": "user",
                "content": "hello", "createdAt": "2026-10-20T10:00:00+08:00",
            }],
            "seenMessages": [{"messageId": "wamid.1", "seenAt": "2026-10-20T10:01:00+08:00"}],
            "reports": [{
                "id": "legacy-report:1", "eventId": None, "userId": "tg:1",
                "date": "2026-10-20", "text": "Practised SQL",
                "summary": "SQL practice", "skillIds": ["sql"], "advanced": [],
                "points": 3, "createdAt": "2026-10-20T10:02:00+08:00",
            }],
            "reportEvents": [{"eventId": "event.1"}],
            "pendingConfirmations": [{
                "userId": "tg:1", "text": "confirm", "lang": "en",
                "createdAt": "2026-10-20T10:03:00+08:00",
            }],
            "expertSessions": [{
                "userId": "tg:1",
                "state": {"careerId": "data-analyst", "lang": "en", "history": [
                    {"role": "user", "content": "How do I start?"},
                    {"role": "assistant", "content": "Learn SQL first."},
                ]},
            }],
        },
    }


class MigrationValidationTests(unittest.TestCase):
    def test_valid_bundle_returns_expected_counts(self):
        counts = backend._validate_bundle(valid_bundle())
        self.assertEqual(counts, {
            "saves": 1, "documents": 2, "messages": 1, "seenMessages": 1,
            "reports": 1, "reportEvents": 1, "pendingConfirmations": 1,
            "expertSessions": 1, "digests": 0,
        })

    def test_bundles_from_older_exports_have_no_expert_sessions(self):
        bundle = valid_bundle()
        del bundle["chatbot"]["expertSessions"]
        self.assertEqual(backend._validate_bundle(bundle)["expertSessions"], 0)

    def test_rejects_expert_sessions_the_live_api_could_not_read(self):
        bundle = valid_bundle()
        bundle["chatbot"]["expertSessions"][0]["userId"] = "wa:60123"
        with self.assertRaisesRegex(ValueError, "tg:<number>"):
            backend._validate_bundle(bundle)

        bundle = valid_bundle()
        bundle["chatbot"]["expertSessions"][0]["state"]["history"].pop()
        with self.assertRaisesRegex(ValueError, "bad-expert-history"):
            backend._validate_bundle(bundle)

    def test_import_writes_expert_sessions(self):
        bundle = valid_bundle()
        backend._validate_bundle(bundle)
        with patch.object(backend, "_execute") as execute:
            backend._insert_bundle(bundle, "a" * 64, "tx-1")
        inserts = [call for call in execute.call_args_list if "INSERT INTO expert_sessions" in call.args[0]]
        self.assertEqual(len(inserts), 1)
        self.assertEqual(inserts[0].args[1]["user_id"], "tg:1")
        self.assertEqual(inserts[0].args[1]["state"]["careerId"], "data-analyst")

    def test_rejects_duplicate_ids_and_invalid_dates(self):
        bundle = valid_bundle()
        bundle["chatbot"]["messages"].append(dict(bundle["chatbot"]["messages"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate message id"):
            backend._validate_bundle(bundle)

        bundle = valid_bundle()
        bundle["chatbot"]["reports"][0]["date"] = "2026-13-40"
        with self.assertRaisesRegex(ValueError, "date must be YYYY-MM-DD"):
            backend._validate_bundle(bundle)

    def test_rejects_noncanonical_date_and_invalid_role(self):
        bundle = valid_bundle()
        bundle["chatbot"]["messages"][0]["role"] = "system"
        with self.assertRaisesRegex(ValueError, "message role"):
            backend._validate_bundle(bundle)

        bundle = valid_bundle()
        bundle["chatbot"]["reports"][0]["date"] = "2026-1-2"
        with self.assertRaisesRegex(ValueError, "date must be YYYY-MM-DD"):
            backend._validate_bundle(bundle)


class ApiSecurityTests(unittest.TestCase):
    def test_missing_or_wrong_bearer_token_is_rejected(self):
        with patch.dict(os.environ, {"AWS_BACKEND_TOKEN_SECRET_ARN": "secret"}, clear=False), \
             patch.object(backend, "_secret", return_value="expected-token"):
            wrong = backend.handler({
                "rawPath": "/v1/no-such-route",
                "headers": {"authorization": "Bearer wrong"},
                "body": "{}",
            }, None)
            absent = backend.handler({
                "rawPath": "/v1/no-such-route", "headers": {}, "body": "{}",
            }, None)
        self.assertEqual(wrong["statusCode"], 401)
        self.assertEqual(absent["statusCode"], 401)
        self.assertEqual(wrong["body"], '{"error":"unauthorized"}')

    def test_authenticated_unknown_path_is_typed_not_sql(self):
        with patch.dict(os.environ, {"AWS_BACKEND_TOKEN_SECRET_ARN": "secret"}, clear=False), \
             patch.object(backend, "_secret", return_value="expected-token"):
            response = backend.handler({
                "requestContext": {"http": {"method": "GET"}},
                "rawPath": "/v1/arbitrary-sql",
                "headers": {"authorization": "Bearer expected-token"},
                "body": "{}",
            }, None)
        self.assertEqual(response["statusCode"], 404)
        self.assertEqual(response["body"], '{"error":"not-found"}')

    def test_malformed_report_date_is_a_client_error_not_a_database_error(self):
        with patch.dict(os.environ, {"AWS_BACKEND_TOKEN_SECRET_ARN": "secret"}, clear=False), \
             patch.object(backend, "_secret", return_value="expected-token"), \
             patch.object(backend, "_execute") as execute, \
             patch.object(backend, "_rows") as rows:
            posted = backend.handler({
                "requestContext": {"http": {"method": "POST"}},
                "rawPath": "/v1/chat/reports",
                "headers": {"authorization": "Bearer expected-token"},
                "body": json.dumps({"userId": "tg:1", "date": "21/10/2026", "text": "SQL"}),
            }, None)
            listed = backend.handler({
                "requestContext": {"http": {"method": "GET"}},
                "rawPath": "/v1/chat/reports",
                "queryStringParameters": {"date": "2026-02-30"},
                "headers": {"authorization": "Bearer expected-token"},
            }, None)
        self.assertEqual((posted["statusCode"], posted["body"]), (400, '{"error":"bad-date"}'))
        self.assertEqual((listed["statusCode"], listed["body"]), (400, '{"error":"bad-date"}'))
        execute.assert_not_called()
        rows.assert_not_called()


class DigestSkillTests(unittest.TestCase):
    def commit_digest(self, skill_id):
        reads = iter([[], [], []])
        with patch.dict(os.environ, {"CAREERSPHERE_SKILL_IDS": "sql"}, clear=False), \
             patch.object(backend, "_ALLOWED_SKILLS", frozenset({"sql"})), \
             patch.object(backend, "_begin", return_value="tx-1"), \
             patch.object(backend, "_rows", side_effect=lambda *args, **kwargs: next(reads)), \
             patch.object(backend, "_execute"), \
             patch.object(backend, "_commit"), \
             patch.object(backend, "_rollback"):
            return backend._commit_save({
                "expectedVersion": 0, "state": {"mastery": {}}, "operation": "digest",
                "metadata": {
                    "idempotencyKey": "digest-1", "fingerprint": "fp",
                    "digest": {"date": "2026-10-24", "skills": [{"skillId": skill_id, "mastery": 40}]},
                },
            })

    def test_custom_skills_of_the_save_are_accepted(self):
        self.assertEqual(self.commit_digest("custom-accounting-standards")["version"], 1)
        self.assertEqual(self.commit_digest("custom-1a2b3c4d")["version"], 1)

    def test_unknown_and_malformed_skill_ids_are_still_rejected(self):
        for skill_id in ("nope", "custom-", "custom-Bad Id", 7):
            with self.assertRaises(backend.ApiError) as caught:
                self.commit_digest(skill_id)
            self.assertEqual(caught.exception.code, "unknown-skill-id", skill_id)


class CleanupTests(unittest.TestCase):
    def test_cleanup_fails_stuck_jobs_and_expires_only_operational_rows(self):
        results = iter([[{"id": "job-1"}], [{"id": "a"}, {"id": "b"}], [], [{"message_id": "m"}]])
        with patch.dict(os.environ, {"AI_JOB_RETENTION_DAYS": "3", "MARKER_RETENTION_DAYS": "bad"}, clear=False), \
             patch.object(backend, "_rows", side_effect=lambda *args, **kwargs: next(results)) as rows:
            summary = backend.cleanup_handler({}, None)
        self.assertEqual(summary, {
            "staleAiJobsFailed": 1, "aiJobsDeleted": 2,
            "idempotencyKeysDeleted": 0, "seenMessagesDeleted": 1,
        })
        statements = [(call.args[0], call.args[1] if len(call.args) > 1 else None) for call in rows.call_args_list]
        self.assertIn("status IN ('queued', 'running')", statements[0][0])
        self.assertEqual(statements[1][1], {"days": 3})
        self.assertIn("NOT LIKE 'legacy:%'", statements[2][0])
        self.assertEqual(statements[2][1], {"days": 30}, "unparseable retention falls back to the default")
        touched = " ".join(sql for sql, _ in statements)
        for kept in ("game_saves", "chat_messages", "learning_reports", "daily_digests", "expert_sessions"):
            self.assertNotIn(kept, touched)


class ProvisioningTests(unittest.TestCase):
    def test_runtime_role_uses_generated_secret_but_fixed_role_name(self):
        runtime_password = "A1" * 24
        worker_password = "B2" * 24
        secrets = {
            "runtime-secret": json.dumps({
                "engine": "postgres", "username": "careersphere_runtime",
                "password": runtime_password, "host": "database.example",
            }),
            "worker-secret": json.dumps({
                "engine": "postgres", "username": "careersphere_ai_worker",
                "password": worker_password, "host": "database.example",
            }),
        }
        with patch.dict(os.environ, {"APPLICATION_DATABASE_SECRET_ARN": "runtime-secret"}, clear=False), \
             patch.dict(os.environ, {"WORKER_DATABASE_SECRET_ARN": "worker-secret"}, clear=False), \
             patch.object(backend, "_secret", side_effect=lambda arn: secrets[arn]), \
             patch.object(backend, "_rows", return_value=[]), \
             patch.object(backend, "_execute") as execute:
            backend._ensure_runtime_database_role()
        statements = [call.args[0] for call in execute.call_args_list]
        self.assertIn(f"CREATE ROLE careersphere_runtime LOGIN PASSWORD '{runtime_password}'", statements)
        self.assertIn(f"CREATE ROLE careersphere_ai_worker LOGIN PASSWORD '{worker_password}'", statements)
        self.assertTrue(any("REVOKE CREATE ON SCHEMA public" in sql for sql in statements))
        self.assertIn("GRANT SELECT, UPDATE ON TABLE ai_jobs TO careersphere_ai_worker", statements)
        self.assertTrue(any("ALTER DEFAULT PRIVILEGES" in sql for sql in statements))

    def test_runtime_role_rejects_unexpected_password_characters(self):
        secret = json.dumps({"username": "careersphere_runtime", "password": "'; DROP ROLE db;--"})
        with patch.dict(os.environ, {"APPLICATION_DATABASE_SECRET_ARN": "runtime-secret"}, clear=False), \
             patch.object(backend, "_secret", return_value=secret), \
             patch.object(backend, "_execute") as execute:
            with self.assertRaises(backend.ApiError) as caught:
                backend._ensure_runtime_database_role()
        self.assertEqual(caught.exception.code, "database-runtime-secret-invalid")
        execute.assert_not_called()


class TransactionTests(unittest.TestCase):
    def test_save_version_conflict_rolls_back_without_writing(self):
        with patch.object(backend, "_begin", return_value="tx-1"), \
             patch.object(backend, "_rows", return_value=[{"version": 7, "state": {"mastery": {}}}]), \
             patch.object(backend, "_execute") as execute, \
             patch.object(backend, "_commit") as commit, \
             patch.object(backend, "_rollback") as rollback:
            with self.assertRaises(backend.ApiError) as caught:
                backend._commit_save({
                    "expectedVersion": 6, "state": {"version": 4}, "operation": "save",
                })
        self.assertEqual(caught.exception.code, "save-version-conflict")
        execute.assert_not_called()
        commit.assert_not_called()
        rollback.assert_called_once_with("tx-1")

    def test_idempotent_duplicate_returns_stored_result(self):
        with patch.object(backend, "_begin", return_value="tx-1"), \
             patch.object(backend, "_rows", return_value=[{
                 "fingerprint": "same", "response": {"result": {"saved": True}, "version": 4},
             }]), \
             patch.object(backend, "_execute") as execute, \
             patch.object(backend, "_commit") as commit, \
             patch.object(backend, "_rollback") as rollback:
            result = backend._commit_save({
                "expectedVersion": 3,
                "state": {"version": 4},
                "operation": "chat",
                "metadata": {"idempotencyKey": "message-1", "fingerprint": "same"},
            })
        self.assertEqual(result, {"result": {"saved": True}, "version": 4, "duplicate": True})
        execute.assert_not_called()
        commit.assert_called_once_with("tx-1")
        rollback.assert_not_called()

    def test_summary_only_digest_cannot_change_mastery(self):
        reads = iter([
            [],
            [],
            [{"version": 2, "state": {"mastery": {"sql": 30}}}],
        ])
        with patch.dict(os.environ, {"CAREERSPHERE_SKILL_IDS": "sql"}, clear=False), \
             patch.object(backend, "_begin", return_value="tx-1"), \
             patch.object(backend, "_rows", side_effect=lambda *args, **kwargs: next(reads)), \
             patch.object(backend, "_execute") as execute, \
             patch.object(backend, "_commit") as commit, \
             patch.object(backend, "_rollback") as rollback:
            with self.assertRaises(backend.ApiError) as caught:
                backend._commit_save({
                    "expectedVersion": 2,
                    "state": {"mastery": {"sql": 31}},
                    "operation": "digest",
                    "metadata": {
                        "idempotencyKey": "digest-1", "fingerprint": "fp",
                        "digest": {"date": "2026-10-20", "summaryOnly": True, "skills": []},
                    },
                })
        self.assertEqual(caught.exception.code, "summary-only-mastery-change")
        execute.assert_not_called()
        commit.assert_not_called()
        rollback.assert_called_once_with("tx-1")


if __name__ == "__main__":
    unittest.main()
