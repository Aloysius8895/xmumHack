import httpx
import pytest

from app import career_api, db
from app.deployment import validate_render_settings


def configured(monkeypatch):
    for key, value in {
        'RENDER': 'true', 'TELEGRAM_BOT_TOKEN': '123456:' + 'a' * 35,
        'TELEGRAM_WEBHOOK_SECRET': 'test_webhook_secret', 'TELEGRAM_ALLOWED_USER_IDS': '123456',
        'CAREERSPHERE_API_URL': 'https://game.onrender.com', 'INTEGRATION_TOKEN': 'integration-test',
        'AI_PROVIDER': 'deepseek', 'DEEPSEEK_API_KEY': 'fake-test-key',
    }.items():
        monkeypatch.setenv(key, value)


def test_render_rejects_local_game_url(monkeypatch):
    configured(monkeypatch)
    monkeypatch.setenv('CAREERSPHERE_API_URL', 'http://127.0.0.1:8787')
    with pytest.raises(RuntimeError, match='HTTPS URL'):
        validate_render_settings()


def test_render_requires_owner_and_provider_key(monkeypatch):
    configured(monkeypatch)
    monkeypatch.setenv('TELEGRAM_ALLOWED_USER_IDS', '')
    with pytest.raises(RuntimeError, match='exactly one numeric'):
        validate_render_settings()
    monkeypatch.setenv('TELEGRAM_ALLOWED_USER_IDS', '123456')
    monkeypatch.delenv('DEEPSEEK_API_KEY')
    with pytest.raises(RuntimeError, match='DEEPSEEK_API_KEY'):
        validate_render_settings()


def test_paid_storage_cannot_fall_back_outside_mount(monkeypatch, tmp_path):
    configured(monkeypatch)
    monkeypatch.setenv('REQUIRE_PERSISTENT_STORAGE', '1')
    monkeypatch.setenv('PERSISTENT_DATA_DIR', str(tmp_path))
    monkeypatch.setenv('DB_PATH', str(tmp_path.parent / 'ephemeral' / 'chat.db'))
    with pytest.raises(RuntimeError, match='mounted PERSISTENT_DATA_DIR'):
        validate_render_settings()
    monkeypatch.setenv('DB_PATH', str(tmp_path / 'chat.db'))
    validate_render_settings()


def test_sqlite_history_and_duplicate_receipt_survive_reopen(monkeypatch, tmp_path):
    monkeypatch.setenv('DB_PATH', str(tmp_path / 'persistent' / 'chat.db'))
    db.init_db()
    db.add_message('tg:123', 'user', 'learning progress')
    assert db.mark_seen('tg:test-persistent-update')
    db.init_db()
    assert db.history('tg:123', 10) == [{'role': 'user', 'content': 'learning progress'}]
    assert not db.mark_seen('tg:test-persistent-update')


def test_game_probe_requires_secret_and_forwards_integration_token(client, monkeypatch):
    monkeypatch.setenv('TELEGRAM_WEBHOOK_SECRET', 'probe-secret')
    monkeypatch.setenv('CAREERSPHERE_API_URL', 'https://game.onrender.com')
    monkeypatch.setenv('INTEGRATION_TOKEN', 'integration-test')
    calls = []
    def get(url, headers, timeout):
        calls.append((url, headers))
        return httpx.Response(200, json={'ok': True, 'storage': 'file'})
    monkeypatch.setattr(httpx, 'get', get)
    assert client.get('/internal/health/game').status_code == 401
    assert calls == []
    response = client.get('/internal/health/game', headers={'X-Telegram-Bot-Api-Secret-Token': 'probe-secret'})
    assert response.status_code == 200
    assert response.json()['game']['ok'] is True
    assert calls == [('https://game.onrender.com/api/integrations/health', {'Authorization': 'Bearer integration-test'})]


def test_game_probe_reports_auth_failure_without_token(client, monkeypatch):
    monkeypatch.setenv('TELEGRAM_WEBHOOK_SECRET', 'probe-secret')
    monkeypatch.setenv('CAREERSPHERE_API_URL', 'https://game.onrender.com')
    monkeypatch.setenv('INTEGRATION_TOKEN', 'never-print-this')
    monkeypatch.setattr(httpx, 'get', lambda *a, **kw: httpx.Response(401))
    response = client.get('/internal/health/game', headers={'X-Telegram-Bot-Api-Secret-Token': 'probe-secret'})
    assert response.status_code == 502
    assert response.json() == {'detail': 'unauthorized'}
    assert 'never-print-this' not in response.text
