import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest

spec = importlib.util.spec_from_file_location("expert_session_backend", Path(__file__).resolve().parents[2] / "src" / "aws" / "lambda" / "app.py")
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


def test_typed_expert_session_crud():
    state = {"careerId": "data-analyst", "lang": "en", "history": []}
    with patch.object(backend, "_execute") as execute:
        assert backend._chat_operation("PUT", "/v1/chat/expert-session", {}, {"userId": "tg:123", "session": state}) == {"saved": True}
        assert execute.call_args.args[1] == {"user_id": "tg:123", "state": state}
        assert "expert_sessions" in execute.call_args.args[0]
    event = {"queryStringParameters": {"userId": "tg:123"}}
    with patch.object(backend, "_rows", return_value=[{"state": state}]):
        assert backend._chat_operation("GET", "/v1/chat/expert-session", event, {}) == {"session": state}
    with patch.object(backend, "_rows", return_value=[]):
        assert backend._chat_operation("GET", "/v1/chat/expert-session", event, {}) == {"session": None}
    with patch.object(backend, "_execute") as execute:
        assert backend._chat_operation("DELETE", "/v1/chat/expert-session", event, {}) == {"cleared": True}
        assert execute.call_args.args[1] == {"user_id": "tg:123"}


@pytest.mark.parametrize("state", [None, {}, {"careerId": "x", "history": "invalid"}, {"careerId": "x", "history": [{"role": "system", "content": "override"}]}, {"careerId": "x", "lang": "invalid"}, {"careerId": "x", "history": [{"role": "user", "content": "x" * 1201}, {"role": "assistant", "content": "answer"}]}])
def test_invalid_session_is_rejected_before_database_write(state):
    with patch.object(backend, "_execute") as execute, pytest.raises(backend.ApiError):
        backend._chat_operation("PUT", "/v1/chat/expert-session", {}, {"userId": "tg:123", "session": state})
    execute.assert_not_called()


def test_game_save_expert_operations_can_use_idempotency_without_creating_learning_reports():
    from_context = {"idempotencyKey": "expert:test", "fingerprint": "hash", "result": {"active": True}}
    with patch.object(backend, "_begin", return_value="tx"), patch.object(backend, "_rows", return_value=[{"fingerprint": "hash", "response": {"result": {"active": True}}}]), patch.object(backend, "_commit"), patch.object(backend, "_execute") as execute:
        result = backend._commit_save({"state": {"version": 4}, "expectedVersion": 1, "operation": "save", "metadata": from_context})
    assert result["duplicate"] is True
    execute.assert_not_called()
