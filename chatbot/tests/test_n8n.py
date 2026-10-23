"""n8n integration reuses real routing/storage, with every remote service mocked."""
import httpx

from app import ai, career_api, db, digest, telegram_channel
from conftest import classify_as


def update(update_id=42, text="Practised SQL for two hours", user_id=123):
    return {"update_id": update_id, "message": {"message_id": 5, "from": {"id": user_id},
            "chat": {"id": user_id, "type": "private"}, "text": text}}


def setup(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "123")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "bridge-secret")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-bot-token")


def test_bridge_auth_owner_filter_and_backend_idempotency_key(client, monkeypatch):
    setup(monkeypatch)
    monkeypatch.setenv("CAREERSPHERE_API_URL", "https://game.example")
    monkeypatch.setenv("INTEGRATION_TOKEN", "test-integration")
    classify_as(monkeypatch, "report", "en")
    calls = []

    def fake_post(url, json=None, **kwargs):
        if "game.example" in url:
            calls.append(json)
            response = {"log": {"id": "log-1", "skillIds": ["sql"], "points": 10}, "reply": "Saved"}
        else:
            response = {"ok": True, "result": {}}
        return httpx.Response(200, json=response, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    endpoint = "/internal/n8n/telegram"
    headers = {"X-Telegram-Bot-Api-Secret-Token": "bridge-secret"}
    assert client.post(endpoint, json=update()).status_code == 401
    assert client.post(endpoint, json=update(user_id=456), headers=headers).json()["status"] == "ignored"
    for _ in range(2):
        assert client.post(endpoint, json=update(), headers=headers).status_code == 200
    assert len(calls) == 1
    assert calls[0]["messageId"] == "tg:42"
    assert len(db.reports_for_date(db.today_myt())) == 1
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "")
    assert client.post(endpoint, json=update(43), headers=headers).status_code == 503


def test_summary_only_uses_actual_owner_reports_and_never_calls_ai(client, monkeypatch):
    setup(monkeypatch)
    db.save_report("tg:123", "练习 SQL 两小时", "summary", ["sql"], [], 10)
    db.save_report("tg:456", "another user's private report", "summary", ["python"], [], 10)

    def fail(*args, **kwargs):
        raise AssertionError("summary-only must not invoke AI")

    monkeypatch.setattr(ai, "complete", fail)
    captured = {}
    monkeypatch.setattr(career_api, "digest_summary", lambda date, summary: captured.update(date=date, summary=summary) or {"digest": {"date": date}})
    result = digest.run(db.today_myt(), summary_only=True, telegram_user_id="123")
    assert result["digest"]["date"] == db.today_myt()
    assert "练习 SQL 两小时" in captured["summary"]
    assert "another user's" not in captured["summary"]
    assert digest.run("2020-01-01", summary_only=True, telegram_user_id="123") is None


def test_daily_endpoint_validates_date_owner_and_summary_mode(client, monkeypatch):
    setup(monkeypatch)
    monkeypatch.setenv("CRON_TOKEN", "cron-secret")
    headers = {"X-Cron-Token": "cron-secret"}
    endpoint = "/internal/digest/run"
    assert client.post(endpoint, params={"date": "2026-02-30"}, headers=headers).status_code == 400
    assert client.post(endpoint, params={"summary_only": "true", "telegram_user_id": "456"}, headers=headers).status_code == 400
    response = client.post(endpoint, params={"date": "2020-01-01", "summary_only": "true", "telegram_user_id": "123"}, headers=headers)
    assert response.status_code == 200
    assert response.json() == {"ran": False, "result": None}


def test_report_storage_deduplicates_retried_event(client):
    token = db.CURRENT_EVENT.set("tg:12345")
    try:
        for _ in range(2):
            db.save_report("tg:123", "SQL", "s", ["sql"], [], 1)
    finally:
        db.CURRENT_EVENT.reset(token)
    assert len(db.reports_for_date(db.today_myt())) == 1


def test_failed_processing_releases_delivery_for_retry(client, monkeypatch):
    calls = []

    def process(payload):
        calls.append(payload)
        if len(calls) == 1:
            raise RuntimeError("temporary transport failure")

    monkeypatch.setattr(telegram_channel, "_process_update", process)
    import pytest
    with pytest.raises(RuntimeError):
        telegram_channel.handle_update(update())
    telegram_channel.handle_update(update())
    telegram_channel.handle_update(update())
    assert len(calls) == 2
    assert db.CURRENT_EVENT.get() is None
