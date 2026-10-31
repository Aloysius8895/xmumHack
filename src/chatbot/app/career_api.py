"""Client for the teammates' CareerSphere game app (Integration API).

Reads CAREERSPHERE_API_URL / INTEGRATION_TOKEN from the environment. Never logs
the token or puts it in an error shown to the user.
"""
import logging
from typing import Optional

import httpx

from .config import get_settings
from . import db

log = logging.getLogger("chatbot")

# A learning report may wait for the game's model call (120 seconds).
TIMEOUT = 135.0


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
    if r.status_code in (400, 404, 409):
        try:
            code = r.json().get("error", "bad-request")
        except ValueError:
            code = "bad-request"
    log.error("CareerSphere %s -> %s %s", path, r.status_code, r.text[:300])
    raise CareerAPIError(code)


def chat(text: str, lang: str, from_: str, channel: str = "whatsapp") -> dict:
    """POST /api/integrations/chat. Returns {"log": {...} | None, "reply": str}."""
    payload = {"channel": channel, "text": text, "lang": lang, "from": from_}
    if db.CURRENT_EVENT.get():
        payload["messageId"] = db.CURRENT_EVENT.get()
    return _post("/api/integrations/chat", payload)


def digest(date: str, summary: str, skills: list[dict]) -> dict:
    """POST /api/integrations/digest. Each skill: {"skillId", "delta"} (mastery not used here)."""
    return _post("/api/integrations/digest", {"date": date, "summary": summary, "skills": skills})


def digest_summary(date: str, summary: str) -> dict:
    """Logs already award progress; n8n's daily summary never awards mastery."""
    return _post("/api/integrations/digest", {"date": date, "summary": summary, "skills": [], "summaryOnly": True})


def expert(text: str, from_: str, action: str, session: Optional[dict] = None) -> dict:
    """The game derives the expert from its saved web target on every request."""
    session = session or {}
    return _post("/api/integrations/expert", {
        "channel": "telegram", "from": from_, "messageId": db.CURRENT_EVENT.get(),
        "action": action, "text": text, "careerId": session.get("careerId"),
        "history": session.get("history", []),
    })


def log_quiz(from_: str, **fields) -> dict:
    return _post("/api/integrations/log-validate", {
        "channel": "telegram", "from": from_, "messageId": db.CURRENT_EVENT.get(),
        **fields,
    })
