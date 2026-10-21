"""The "is this a report?" confirm-button flow for ambiguous messages."""
from app import career_api, db

from conftest import PHONE, classify_as, send_button, send_raw


def test_uncertain_message_sends_confirm_buttons(client, monkeypatch):
    classify_as(monkeypatch, "uncertain", "zh")
    outbox = send_raw(client, "SQL")
    assert len(outbox) == 1
    interactive = outbox[0]["interactive"]
    assert interactive["type"] == "button"
    titles = [b["reply"]["title"] for b in interactive["action"]["buttons"]]
    assert len(interactive["action"]["buttons"]) <= 3
    assert all(len(t) <= 20 for t in titles)
    assert db.pop_pending(PHONE) == {"text": "SQL", "lang": "zh"}


def test_uncertain_not_whitelisted_skips_buttons_goes_to_chat(client, fake_ai, monkeypatch):
    monkeypatch.setenv("ALLOWED_WA_IDS", "60999999999")
    classify_as(monkeypatch, "uncertain", "zh")
    outbox = send_raw(client, "SQL")
    assert outbox[0]["type"] == "text"
    assert db.pop_pending(PHONE) is None


def test_confirm_yes_submits_report(client, monkeypatch):
    classify_as(monkeypatch, "uncertain", "zh")
    send_raw(client, "练了 SQL JOIN")

    monkeypatch.setattr(career_api, "chat", lambda text, lang, from_: {
        "log": {"summary": "s", "skillIds": ["sql"], "advanced": [], "points": 10}, "reply": "好样的！",
    })
    assert send_button(client, "report_yes") == ["好样的！"]
    assert db.reports_for_date(db.today_myt())[0]["text"] == "练了 SQL JOIN"
    assert db.pop_pending(PHONE) is None


def test_confirm_no_does_not_submit_report(client, monkeypatch):
    classify_as(monkeypatch, "uncertain", "zh")
    send_raw(client, "随便聊聊")

    def fail(*a, **kw):
        raise AssertionError("should not call career_api.chat")
    monkeypatch.setattr(career_api, "chat", fail)
    reply = send_button(client, "report_no")[0]
    assert "没有记录" in reply
    assert db.reports_for_date(db.today_myt()) == []


def test_button_without_pending_is_handled_gracefully(client):
    reply = send_button(client, "report_yes")[0]
    assert "已经处理过" in reply


def test_unknown_button_id_is_ignored(client):
    assert send_button(client, "something_else") == []
