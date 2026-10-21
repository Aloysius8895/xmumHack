"""Telegram channel: webhook secret check, /start, report forwarding (with
channel="telegram" and from="tg:<id>"), button callbacks, whitelist, duplicate
updates, and non-text messages. The Telegram Bot API is mocked via httpx.post."""
import itertools
import logging

import httpx
import pytest

from app import career_api, db

from conftest import classify_as

SECRET = "tg-secret"
TOKEN = "123456:ABC-DEF"
USER_ID = 999001
CHAT_ID = USER_ID
_ids = itertools.count(1)


@pytest.fixture()
def tg_client(client, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TOKEN)
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", SECRET)
    return client


def _capture_telegram(monkeypatch, extra_post=None):
    """Mocks httpx.post for api.telegram.org, recording every call; any other
    URL is handed to `extra_post` (used by the report-forwarding test, where
    CareerSphere's /api/integrations/chat is also mocked via httpx.post)."""
    sent = []

    def fake_post(url, json=None, headers=None, timeout=None, **kw):
        if "api.telegram.org" in url:
            sent.append({"method": url.rsplit("/", 1)[-1], "payload": json})
            return httpx.Response(200, json={"ok": True, "result": {}}, request=httpx.Request("POST", url))
        if extra_post:
            return extra_post(url, json, headers, timeout)
        raise AssertionError(f"unexpected POST to {url}")
    monkeypatch.setattr(httpx, "post", fake_post)
    return sent


def _text_message(text=None, mid=None, photo=False) -> dict:
    msg = {
        "message_id": mid or next(_ids),
        "date": 1760000000,
        "chat": {"id": CHAT_ID, "type": "private"},
        "from": {"id": USER_ID, "is_bot": False, "first_name": "Test"},
    }
    if photo:
        msg["photo"] = [{"file_id": "abc"}]
    else:
        msg["text"] = text
    return msg


def _update(message=None, callback_query=None) -> dict:
    u = {"update_id": next(_ids)}
    if message is not None:
        u["message"] = message
    if callback_query is not None:
        u["callback_query"] = callback_query
    return u


def post_update(client, update: dict, secret=SECRET):
    headers = {"X-Telegram-Bot-Api-Secret-Token": secret} if secret is not None else {}
    return client.post("/telegram/webhook", json=update, headers=headers)


def test_bad_secret_rejected(tg_client):
    assert post_update(tg_client, _update(_text_message("hi")), secret="wrong").status_code == 401
    assert post_update(tg_client, _update(_text_message("hi")), secret=None).status_code == 401


def test_secret_rejected_when_not_configured(client):
    # TELEGRAM_WEBHOOK_SECRET unset -> always 401, even with a matching header.
    assert post_update(client, _update(_text_message("hi")), secret="anything").status_code == 401


def test_start_shows_user_id(tg_client, monkeypatch):
    sent = _capture_telegram(monkeypatch)
    r = post_update(tg_client, _update(_text_message("/start")))
    assert r.status_code == 200
    assert len(sent) == 1
    assert sent[0]["method"] == "sendMessage"
    assert str(USER_ID) in sent[0]["payload"]["text"]


def test_report_forwarded_with_telegram_channel_and_from(tg_client, monkeypatch):
    monkeypatch.setenv("CAREERSPHERE_API_URL", "https://careersphere.example")
    monkeypatch.setenv("INTEGRATION_TOKEN", "secret-token")
    classify_as(monkeypatch, "report", "en")
    captured = {}

    def fake_career_post(url, json, headers, timeout):
        captured["json"] = json
        return httpx.Response(200, json={"log": None, "reply": "Nice work!"}, request=httpx.Request("POST", url))

    sent = _capture_telegram(monkeypatch, extra_post=fake_career_post)
    post_update(tg_client, _update(_text_message("studied SQL for 2 hours")))

    assert captured["json"]["channel"] == "telegram"
    assert captured["json"]["from"] == f"tg:{USER_ID}"
    assert sent[-1]["payload"]["text"] == "Nice work!"


def test_button_callback_logs_report_and_answers_callback(tg_client, monkeypatch):
    sent = _capture_telegram(monkeypatch)
    classify_as(monkeypatch, "uncertain", "en")
    post_update(tg_client, _update(_text_message("SQL")))

    assert sent[-1]["method"] == "sendMessage"
    keyboard = sent[-1]["payload"]["reply_markup"]["inline_keyboard"]
    assert keyboard[0][0]["callback_data"] == "report_yes"

    def fake_chat(text, lang, from_, channel="telegram"):
        return {"log": {"summary": "s", "skillIds": ["sql"], "advanced": [], "points": 5}, "reply": "好样的！"}
    monkeypatch.setattr(career_api, "chat", fake_chat)

    cq = {"id": "cbq1", "from": {"id": USER_ID}, "data": "report_yes"}
    post_update(tg_client, _update(callback_query=cq))

    assert any(m["method"] == "answerCallbackQuery" for m in sent)
    assert sent[-1]["payload"]["text"] == "好样的！"
    assert db.reports_for_date(db.today_myt())[0]["text"] == "SQL"


def test_whitelist_blocks_report_for_unknown_telegram_user(tg_client, fake_ai, monkeypatch):
    _capture_telegram(monkeypatch)
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "1,2,3")
    classify_as(monkeypatch, "report", "en")

    def fail(*a, **kw):
        raise AssertionError("career_api.chat should not be called for a non-whitelisted telegram user")
    monkeypatch.setattr(career_api, "chat", fail)
    post_update(tg_client, _update(_text_message("studied today")))
    assert len(fake_ai) == 1


def test_duplicate_update_ignored(tg_client, fake_ai, monkeypatch):
    _capture_telegram(monkeypatch)
    update = _update(_text_message("hi"))
    post_update(tg_client, update)
    post_update(tg_client, update)
    assert len(fake_ai) == 1


def test_non_text_message_gets_text_only_reply(tg_client, monkeypatch):
    sent = _capture_telegram(monkeypatch)
    post_update(tg_client, _update(_text_message(photo=True)))
    assert "只支持文字" in sent[-1]["payload"]["text"]


def test_group_chat_messages_are_ignored(tg_client, fake_ai, monkeypatch):
    sent = _capture_telegram(monkeypatch)
    msg = _text_message("hello group")
    msg["chat"] = {"id": -12345, "type": "group"}
    post_update(tg_client, _update(msg))
    assert sent == []
    assert fake_ai == []


def test_telegram_requests_do_not_leak_bot_token_in_logs(tg_client, monkeypatch, caplog):
    """httpx logs "HTTP Request: <method> <url> ..." at INFO, and the Telegram API
    url embeds the bot token. app/main.py quiets the httpx/httpcore loggers to
    WARNING; this test goes through a real httpx.Client (via MockTransport, not
    a bypassed httpx.post) so that httpx's actual request-logging code path runs,
    to prove the suppression actually holds rather than just not being exercised."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True, "result": {}})

    def fake_post(url, json=None, headers=None, timeout=None, **kw):
        with httpx.Client(transport=httpx.MockTransport(handler)) as c:
            return c.post(url, json=json, timeout=timeout)
    monkeypatch.setattr(httpx, "post", fake_post)

    with caplog.at_level(logging.DEBUG):
        post_update(tg_client, _update(_text_message("/start")))

    assert TOKEN not in caplog.text
