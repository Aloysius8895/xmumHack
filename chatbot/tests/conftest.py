"""Shared fixtures: a TestClient wired to a scratch DB, a mocked AI reply, and a
mocked message classifier (defaults every message to "chat" so existing chat
tests don't need to know about classification; override per test as needed)."""
import hashlib
import hmac
import itertools
import json

import pytest
from fastapi.testclient import TestClient

from app import ai, classify, whatsapp_api as wa

SECRET = "test-secret"
PHONE = "60123456789"
_ids = itertools.count(1)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "chat.db"))
    monkeypatch.setenv("WHATSAPP_APP_SECRET", SECRET)
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "verify-me")
    monkeypatch.setenv("WHATSAPP_DRY_RUN", "true")
    wa.OUTBOX.clear()
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def fake_ai(monkeypatch):
    seen = []

    def reply(history):
        seen.append([dict(m) for m in history])
        return f"AI reply #{len(seen)}"
    monkeypatch.setattr(ai, "reply", reply)
    return seen


@pytest.fixture(autouse=True)
def fake_classify(monkeypatch):
    monkeypatch.setattr(classify, "classify_message", lambda text: {"type": "chat", "lang": "en"})


def classify_as(monkeypatch, kind: str, lang: str = "en"):
    monkeypatch.setattr(classify, "classify_message", lambda text: {"type": kind, "lang": lang})


def _sign(body: bytes) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def _wrap(msg: dict) -> bytes:
    return json.dumps({"object": "whatsapp_business_account", "entry": [{"changes": [{
        "field": "messages", "value": {"messages": [msg]}}]}]}).encode()


def _post_and_capture(client, msg: dict) -> list:
    body = _wrap(msg)
    wa.OUTBOX.clear()
    r = client.post("/whatsapp/webhook", content=body, headers={"X-Hub-Signature-256": _sign(body)})
    assert r.status_code == 200, r.text
    return list(wa.OUTBOX)


def send(client, text=None, *, mtype="text", frm=PHONE, mid=None):
    msg = {"from": frm, "id": mid or f"wamid.{next(_ids)}", "timestamp": "1760000000", "type": mtype}
    if mtype == "text":
        msg["text"] = {"body": text}
    return [m["text"]["body"] for m in _post_and_capture(client, msg) if m.get("type") == "text"]


def send_raw(client, text, *, frm=PHONE, mid=None):
    """Like send(), but returns every outgoing message payload, text or interactive
    (the mark-as-read status call, which has no "type" key, is filtered out)."""
    msg = {"from": frm, "id": mid or f"wamid.{next(_ids)}", "timestamp": "1760000000", "type": "text",
           "text": {"body": text}}
    return [m for m in _post_and_capture(client, msg) if "type" in m]


def send_button(client, button_id: str, title: str = "", *, frm=PHONE, mid=None):
    msg = {
        "from": frm, "id": mid or f"wamid.{next(_ids)}", "timestamp": "1760000000", "type": "interactive",
        "interactive": {"type": "button_reply", "button_reply": {"id": button_id, "title": title}},
    }
    return [m["text"]["body"] for m in _post_and_capture(client, msg) if m.get("type") == "text"]
