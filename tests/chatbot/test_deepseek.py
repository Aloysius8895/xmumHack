from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from app import ai, classify, digest


@pytest.fixture
def deepseek(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "wrong-key")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "wrong-token")
    monkeypatch.setenv("AI_MODEL", "wrong-model")
    monkeypatch.delenv("DEEPSEEK_MODEL", raising=False)
    client = MagicMock()
    client.__enter__.return_value = client
    constructor = MagicMock(return_value=client)
    monkeypatch.setattr("anthropic.Anthropic", constructor)
    client.messages.create.return_value = SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="Hello")])
    return constructor, client


def test_only_deepseek_credentials_and_model_are_used(deepseek):
    constructor, client = deepseek
    assert ai.provider() == "deepseek"
    assert ai.model_name() == "deepseek-flash"
    assert ai.reply([{"role": "user", "content": "Hi"}]) == "Hello"
    assert constructor.call_args.kwargs == dict(api_key="deepseek-test-key", auth_token=None, base_url="https://api.deepseek.com/anthropic", timeout=120.0, max_retries=0)
    assert client.messages.create.call_args.kwargs["thinking"] == {"type": "disabled"}
    assert client.messages.create.call_args.kwargs["model"] == "deepseek-flash"


def test_missing_key_does_not_fall_back(deepseek, monkeypatch):
    constructor, _ = deepseek
    monkeypatch.delenv("DEEPSEEK_API_KEY")
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY"):
        ai.complete("Classify")
    constructor.assert_not_called()


def test_custom_deepseek_model(deepseek, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v4-pro")
    assert ai.model_name() == "deepseek-v4-pro"


def test_classification_and_digest_use_same_deepseek_adapter(deepseek, monkeypatch):
    _, client = deepseek
    # The existing test suite mocks classification globally; restore the real function here.
    import importlib
    real_classify = importlib.reload(classify).classify_message
    client.messages.create.return_value = SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text='{"type":"report","lang":"en"}')])
    assert real_classify("Practised SQL for 2 hours")["type"] == "report"
    client.messages.create.return_value = SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text='{"summary":"Practised SQL","skills":[]}')])
    assert digest._draft([{"skill_ids": ["sql"], "text": "Practised SQL"}])["summary"] == "Practised SQL"
    assert client.messages.create.call_count == 2


def test_empty_and_truncated_results_fail(deepseek):
    _, client = deepseek
    client.messages.create.return_value = SimpleNamespace(stop_reason="max_tokens", content=[])
    with pytest.raises(RuntimeError, match="truncated"):
        ai.complete("Classify")
    client.messages.create.return_value = SimpleNamespace(stop_reason="end_turn", content=[])
    with pytest.raises(RuntimeError, match="empty"):
        ai.complete("Classify")


def test_actual_sdk_request_does_not_leak_other_provider_credentials(monkeypatch):
    import anthropic
    # SDK releases use either httpx or httpx2; use the transport type expected by this SDK.
    from anthropic import _base_client
    httpx = getattr(_base_client, "httpx2", None) or _base_client.httpx
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "wrong-key")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "wrong-token")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://wrong.example")
    requests = []

    def handle(request):
        requests.append(request)
        return httpx.Response(200, json={"id": "m", "type": "message", "role": "assistant", "model": "deepseek-flash", "content": [{"type": "text", "text": "Ready"}], "stop_reason": "end_turn", "usage": {"input_tokens": 1, "output_tokens": 1}})

    constructor = anthropic.Anthropic
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kwargs: constructor(**kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle))))
    assert ai.complete("Check") == "Ready"
    assert str(requests[0].url) == "https://api.deepseek.com/anthropic/v1/messages"
    assert all("wrong" not in value for value in requests[0].headers.values())
    assert "deepseek-test-key" in (requests[0].headers.get("x-api-key", "") + requests[0].headers.get("authorization", ""))
