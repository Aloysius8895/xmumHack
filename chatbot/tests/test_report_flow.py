"""Report classification -> CareerSphere /chat -> reply, error handling, whitelist gating."""
import pytest

from app import career_api, db

from conftest import classify_as, send


def test_report_success_saves_and_replies(client, monkeypatch):
    classify_as(monkeypatch, "report", "zh")
    monkeypatch.setattr(career_api, "chat", lambda text, lang, from_, channel="whatsapp": {
        "log": {"summary": "练习 SQL JOIN", "skillIds": ["sql"],
                "advanced": [{"taskId": "t3", "from": 20, "to": 45}], "points": 50},
        "reply": "做得好！SQL JOIN 任务进度到 45%",
    })
    assert send(client, "今天练了 SQL JOIN 两小时") == ["做得好！SQL JOIN 任务进度到 45%"]
    saved = db.reports_for_date(db.today_myt())
    assert saved[0]["skill_ids"] == ["sql"] and saved[0]["points"] == 50


def test_report_with_null_log_still_replies_but_does_not_save(client, monkeypatch):
    classify_as(monkeypatch, "report", "zh")
    monkeypatch.setattr(career_api, "chat", lambda text, lang, from_, channel="whatsapp": {
        "log": None, "reply": "先去生成你的学习路线哦～",
    })
    assert send(client, "练了一下") == ["先去生成你的学习路线哦～"]
    assert db.reports_for_date(db.today_myt()) == []


@pytest.mark.parametrize("code", ["unauthorized", "service-unavailable"])
def test_auth_style_errors_show_generic_misconfig_message(client, monkeypatch, code):
    classify_as(monkeypatch, "report")

    def boom(text, lang, from_, channel="whatsapp"):
        raise career_api.CareerAPIError(code)
    monkeypatch.setattr(career_api, "chat", boom)
    reply = send(client, "练了一下")[0]
    assert "misconfigured" in reply.lower()
    assert db.reports_for_date(db.today_myt()) == []


@pytest.mark.parametrize("code", ["upstream-error", "timeout", "network-error", "bad-channel"])
def test_transient_errors_show_retry_message_and_are_not_logged(client, monkeypatch, code):
    classify_as(monkeypatch, "report")

    def boom(text, lang, from_, channel="whatsapp"):
        raise career_api.CareerAPIError(code)
    monkeypatch.setattr(career_api, "chat", boom)
    reply = send(client, "练了一下")[0]
    assert "couldn't save" in reply.lower()
    assert db.reports_for_date(db.today_myt()) == []


def test_whitelisted_number_calls_career_api(client, monkeypatch):
    monkeypatch.setenv("ALLOWED_WA_IDS", "60123456789,60999999999")
    classify_as(monkeypatch, "report")
    called = {}

    def fake_chat(text, lang, from_, channel="whatsapp"):
        called["yes"] = True
        return {"log": None, "reply": "ok"}
    monkeypatch.setattr(career_api, "chat", fake_chat)
    send(client, "练了一下")
    assert called.get("yes") is True


def test_non_whitelisted_number_never_calls_career_api(client, fake_ai, monkeypatch):
    monkeypatch.setenv("ALLOWED_WA_IDS", "60999999999")
    classify_as(monkeypatch, "report")

    def fail(*a, **kw):
        raise AssertionError("career_api.chat should not be called for a non-whitelisted number")
    monkeypatch.setattr(career_api, "chat", fail)
    reply = send(client, "练了一下")[0]
    assert "demo" in reply
    assert db.reports_for_date(db.today_myt()) == []
