"""Simulates Meta's webhook end to end. The AI is mocked and nothing is sent to WhatsApp."""
from app import ai

from conftest import send


def test_handshake(client):
    params = {"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42"}
    assert client.get("/whatsapp/webhook", params=params).text == "42"
    params["hub.verify_token"] = "wrong"
    assert client.get("/whatsapp/webhook", params=params).status_code == 403


def test_bad_signature_rejected(client):
    r = client.post("/whatsapp/webhook", content=b"{}", headers={"X-Hub-Signature-256": "sha256=00"})
    assert r.status_code == 401
    assert client.post("/whatsapp/webhook", content=b"{}").status_code == 401


def test_ai_replies_and_remembers_conversation(client, fake_ai):
    assert send(client, "你好") == ["AI reply #1"]
    assert send(client, "我想做数据分析") == ["AI reply #2"]
    assert fake_ai[1] == [
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "AI reply #1"},
        {"role": "user", "content": "我想做数据分析"},
    ]


def test_conversations_are_separate_per_number(client, fake_ai):
    send(client, "A", frm="601")
    send(client, "B", frm="602")
    assert fake_ai[1] == [{"role": "user", "content": "B"}]


def test_duplicate_delivery_ignored(client, fake_ai):
    send(client, "hi", mid="wamid.same")
    assert send(client, "hi", mid="wamid.same") == []
    assert len(fake_ai) == 1


def test_reset_clears_history(client, fake_ai):
    send(client, "记住我叫小明")
    assert "重新开始" in send(client, "重新开始")[0]
    send(client, "我叫什么？")
    assert fake_ai[-1] == [{"role": "user", "content": "我叫什么？"}]


def test_ai_failure_sends_fallback(client, monkeypatch):
    def boom(_):
        raise RuntimeError("AI down")
    monkeypatch.setattr(ai, "reply", boom)
    assert "稍后" in send(client, "hello")[0]


def test_non_text_message(client, fake_ai):
    assert "文字" in send(client, mtype="image")[0]
    assert fake_ai == []


def test_provider_detection(monkeypatch):
    for k in ["AI_PROVIDER", "AI_MODEL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
              "AI_INTEGRATIONS_ANTHROPIC_API_KEY", "AI_INTEGRATIONS_OPENAI_API_KEY"]:
        monkeypatch.delenv(k, raising=False)
    assert ai.provider() is None
    monkeypatch.setenv("AI_INTEGRATIONS_OPENAI_API_KEY", "x")
    assert ai.provider() == "openai" and ai.model_name() == "gpt-5-mini"
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "y")
    assert ai.provider() == "anthropic"
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("AI_MODEL", "some-model")
    assert ai.provider() == "openai" and ai.model_name() == "some-model"


def test_history_normalised_for_anthropic():
    h = [{"role": "assistant", "content": "x"}, {"role": "user", "content": "a"},
         {"role": "user", "content": "b"}]
    assert ai._normalise(h) == [{"role": "user", "content": "a\nb"}]


def test_real_sdk_call_shape(monkeypatch):
    """Checks the request we build for Replit's Anthropic integration, without network."""
    import anthropic
    captured = {}

    class FakeMessages:
        def create(self, **kw):
            captured.update(kw)
            class B:
                type = "text"
                text = "hi!"
            class R:
                content = [B()]
            return R()

    class FakeClient:
        def __init__(self, **kw):
            captured["client"] = kw
            self.messages = FakeMessages()

    monkeypatch.setattr(anthropic, "Anthropic", FakeClient)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "replit-key")
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "https://replit.example/anthropic")
    assert ai.reply([{"role": "user", "content": "hello"}]) == "hi!"
    assert captured["client"] == {"api_key": "replit-key", "base_url": "https://replit.example/anthropic"}
    assert captured["model"] == "claude-haiku-4-5" and captured["system"] == ai.SYSTEM_PROMPT
