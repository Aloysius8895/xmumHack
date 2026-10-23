import httpx
import pytest

from app import ai, aws_backend, db


def test_aws_provider_is_explicit_and_never_falls_back(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "deepseek_direct")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "must-not-be-used")
    monkeypatch.delenv("AWS_BACKEND_URL", raising=False)
    monkeypatch.delenv("AWS_BACKEND_TOKEN", raising=False)

    assert ai.provider() == "deepseek_direct"
    with pytest.raises(RuntimeError, match="aws-backend-not-configured"):
        ai.reply([{"role": "user", "content": "Hello"}])


def test_partial_aws_configuration_fails_instead_of_using_local_storage(monkeypatch):
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    monkeypatch.setenv("AWS_BACKEND_URL", "https://aws.example")
    monkeypatch.delenv("AWS_BACKEND_TOKEN", raising=False)
    with pytest.raises(RuntimeError, match="must be configured together"):
        ai.provider()
    with pytest.raises(aws_backend.AwsBackendError, match="aws-backend-config-incomplete"):
        db.init_db()


def test_remote_ai_uses_only_the_server_bearer_token(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "bedrock")
    monkeypatch.setenv("AWS_BACKEND_URL", "https://aws.example")
    monkeypatch.setenv("AWS_BACKEND_TOKEN", "backend-only-token")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "must-not-be-used")
    calls = []

    def fake_request(method, url, **kwargs):
        calls.append((method, url, kwargs))
        if method == "POST":
            return httpx.Response(202, json={"jobId": "job-1", "status": "queued"})
        return httpx.Response(200, json={"jobId": "job-1", "status": "succeeded", "text": "Try SQL."})

    monkeypatch.setattr(httpx, "request", fake_request)
    monkeypatch.setattr(aws_backend.time, "sleep", lambda _: None)
    assert ai.reply([{"role": "user", "content": "What next?"}]) == "Try SQL."
    assert len(calls) == 2
    method, url, options = calls[0]
    assert (method, url) == ("POST", "https://aws.example/v1/ai/jobs")
    assert options["headers"]["Authorization"] == "Bearer backend-only-token"
    assert options["json"]["provider"] == "bedrock"
    assert "backend-only-token" not in url
    assert "must-not-be-used" not in str(options["json"])


def test_remote_database_does_not_initialize_or_write_local_sqlite(monkeypatch):
    calls = []
    monkeypatch.setattr(db.aws_backend, "enabled", lambda: True)
    monkeypatch.setattr(db, "connect", lambda: (_ for _ in ()).throw(AssertionError("local SQLite used")))
    monkeypatch.setattr(
        db.aws_backend, "data_call",
        lambda method, path, *, body=None, params=None: calls.append((method, path, body, params)) or {"saved": True},
    )

    db.init_db()
    db.add_message("tg:1", "user", "Hello")
    assert calls[0][0:2] == ("POST", "/v1/chat/messages")
    assert calls[0][2]["userId"] == "tg:1"
    assert calls[0][2]["content"] == "Hello"
