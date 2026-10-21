"""app.career_api: maps CareerSphere responses/errors to CareerAPIError codes."""
import httpx
import pytest

from app import career_api


def _settings(monkeypatch, url="https://careersphere.example", token="secret-token"):
    monkeypatch.setenv("CAREERSPHERE_API_URL", url)
    monkeypatch.setenv("INTEGRATION_TOKEN", token)


def _fake_response(monkeypatch, *, status_code=200, json_body=None, raise_=None):
    def fake_post(url, json, headers, timeout):
        if raise_:
            raise raise_
        return httpx.Response(status_code, json=json_body or {}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx, "post", fake_post)


def test_chat_success(monkeypatch):
    _settings(monkeypatch)
    _fake_response(monkeypatch, status_code=200, json_body={"log": {"id": "1"}, "reply": "做得好！"})
    result = career_api.chat("练了 SQL", "zh", "+60123")
    assert result["reply"] == "做得好！"


def test_sends_bearer_token_and_no_token_leak_in_url(monkeypatch):
    _settings(monkeypatch, token="super-secret-xyz")
    captured = {}

    def fake_post(url, json, headers, timeout):
        captured["url"] = url
        captured["headers"] = headers
        return httpx.Response(200, json={"reply": "ok"}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx, "post", fake_post)
    career_api.chat("x", "en", "+60123")
    assert captured["headers"]["Authorization"] == "Bearer super-secret-xyz"
    assert "super-secret-xyz" not in captured["url"]


def test_missing_config_is_service_unavailable(monkeypatch):
    monkeypatch.delenv("CAREERSPHERE_API_URL", raising=False)
    monkeypatch.delenv("INTEGRATION_TOKEN", raising=False)
    with pytest.raises(career_api.CareerAPIError) as exc:
        career_api.chat("x", "en", "+60123")
    assert exc.value.code == "service-unavailable"


@pytest.mark.parametrize("status,body,expected", [
    (401, {"error": "unauthorized"}, "unauthorized"),
    (503, {"error": "service-unavailable"}, "service-unavailable"),
    (502, {"error": "upstream"}, "upstream-error"),
    (400, {"error": "bad-channel"}, "bad-channel"),
    (400, {"error": "empty"}, "empty"),
])
def test_error_status_codes_map_to_codes(monkeypatch, status, body, expected):
    _settings(monkeypatch)
    _fake_response(monkeypatch, status_code=status, json_body=body)
    with pytest.raises(career_api.CareerAPIError) as exc:
        career_api.chat("x", "en", "+60123")
    assert exc.value.code == expected


def test_timeout_maps_to_timeout_code(monkeypatch):
    _settings(monkeypatch)
    _fake_response(monkeypatch, raise_=httpx.TimeoutException("slow"))
    with pytest.raises(career_api.CareerAPIError) as exc:
        career_api.chat("x", "en", "+60123")
    assert exc.value.code == "timeout"


def test_connection_error_maps_to_network_error(monkeypatch):
    _settings(monkeypatch)
    _fake_response(monkeypatch, raise_=httpx.ConnectError("refused"))
    with pytest.raises(career_api.CareerAPIError) as exc:
        career_api.chat("x", "en", "+60123")
    assert exc.value.code == "network-error"


def test_digest_success(monkeypatch):
    _settings(monkeypatch)
    _fake_response(monkeypatch, status_code=200, json_body={"digest": {"date": "2026-10-21"}})
    result = career_api.digest("2026-10-21", "练了 SQL", [{"skillId": "sql", "delta": 5, "evidence": "..."}])
    assert result["digest"]["date"] == "2026-10-21"
