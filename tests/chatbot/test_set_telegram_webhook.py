"""The webhook script must never print the bot token, even when requests fail."""

import importlib.util
import pathlib
import sys

import httpx
import pytest

SCRIPT = pathlib.Path(__file__).resolve().parents[2] / "src" / "chatbot" / "scripts" / "set_telegram_webhook.py"
TOKEN = "123456789:AAH_fake-token-for-tests-0123456789abcdef"
SECRET = "fake-webhook-secret"


@pytest.fixture
def script(monkeypatch):
    spec = importlib.util.spec_from_file_location("set_telegram_webhook", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TOKEN)
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(sys, "argv", ["set_telegram_webhook.py", "https://example.test"])
    return module


def _run(script, capsys):
    with pytest.raises(SystemExit) as exc:
        script.main()
    out = capsys.readouterr()
    return exc.value.code, out.out + out.err


def test_http_error_response_does_not_print_token(script, capsys, monkeypatch):
    url = f"https://api.telegram.org/bot{TOKEN}/setWebhook"
    response = httpx.Response(404, json={"ok": False, "description": "Not Found"},
                              request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx, "post", lambda *a, **k: response)

    code, output = _run(script, capsys)

    assert code == 1
    assert TOKEN not in output
    assert TOKEN.split(":")[1] not in output
    assert "setWebhook failed: HTTP 404 Not Found" in output


def test_transport_error_does_not_print_token(script, capsys, monkeypatch):
    def boom(*args, **kwargs):
        raise httpx.ConnectError(f"cannot connect to https://api.telegram.org/bot{TOKEN}/setWebhook")

    monkeypatch.setattr(httpx, "post", boom)

    code, output = _run(script, capsys)

    assert code == 1
    assert TOKEN not in output
    assert "setWebhook failed: ConnectError" in output


def test_incomplete_token_is_rejected_before_any_request(script, capsys, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "8635265161")

    def no_request(*args, **kwargs):
        raise AssertionError("must not call Telegram with a malformed token")

    monkeypatch.setattr(httpx, "post", no_request)

    code, output = _run(script, capsys)

    assert code == 1
    assert "TELEGRAM_BOT_TOKEN looks incomplete (expected <bot id>:<secret>)" in output
    assert "8635265161" not in output
