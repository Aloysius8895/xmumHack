"""Client for the teammates' CareerSphere game app (Integration API).

Reads CAREERSPHERE_API_URL / INTEGRATION_TOKEN from the environment. Never logs
the token or puts it in an error shown to the user.
"""
import logging
from typing import Optional

import httpx

from .config import get_settings

log = logging.getLogger("whatsapp")

TIMEOUT = 15.0


class CareerAPIError(Exception):
    """code: one of the API's error codes (bad-channel, empty, bad-date, bad-skills,
    unauthorized, service-unavailable, upstream-error, timeout, network-error)."""

    def __init__(self, code: str, detail: str = ""):
        self.code = code
        super().__init__(f"{code}: {detail}" if detail else code)


_STATUS_CODE = {401: "unauthorized", 503: "service-unavailable", 502: "upstream-error"}


def _post(path: str, payload: dict) -> dict:
    st = get_settings()
    if not st.careersphere_api_url or not st.integration_token:
        raise CareerAPIError("service-unavailable", "CAREERSPHERE_API_URL or INTEGRATION_TOKEN not set")
    url = f"{st.careersphere_api_url}{path}"
    headers = {"Authorization": f"Bearer {st.integration_token}", "Content-Type": "application/json"}
    try:
        r = httpx.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except httpx.TimeoutException as e:
        raise CareerAPIError("timeout") from e
    except httpx.HTTPError as e:
        raise CareerAPIError("network-error", str(e)) from e

    if r.status_code == 200:
        return r.json()

    code = _STATUS_CODE.get(r.status_code, "upstream-error")
    if r.status_code == 400:
        try:
            code = r.json().get("error", "bad-request")
        except ValueError:
            code = "bad-request"
    log.error("CareerSphere %s -> %s %s", path, r.status_code, r.text[:300])
    raise CareerAPIError(code)


def chat(text: str, lang: str, from_: str) -> dict:
    """POST /api/integrations/chat. Returns {"log": {...} | None, "reply": str}."""
    return _post("/api/integrations/chat", {"channel": "whatsapp", "text": text, "lang": lang, "from": from_})


def digest(date: str, summary: str, skills: list[dict]) -> dict:
    """POST /api/integrations/digest. Each skill: {"skillId", "delta"} (mastery not used here)."""
    return _post("/api/integrations/digest", {"date": date, "summary": summary, "skills": skills})
