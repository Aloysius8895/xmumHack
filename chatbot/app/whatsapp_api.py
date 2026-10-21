"""Minimal client for the official WhatsApp Cloud API (Meta Graph API).

In dry-run mode nothing is sent; outgoing messages go to OUTBOX instead.
"""
import hashlib
import hmac
import logging
from typing import Optional

import httpx

from .config import get_settings

log = logging.getLogger("chatbot")
OUTBOX: list[dict] = []


def verify_signature(raw_body: bytes, header: Optional[str]) -> bool:
    """X-Hub-Signature-256 must equal 'sha256=' + HMAC-SHA256(app secret, raw body)."""
    secret = get_settings().app_secret
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def _post(payload: dict) -> Optional[dict]:
    st = get_settings()
    payload = {"messaging_product": "whatsapp", **payload}
    if st.dry_run:
        OUTBOX.append(payload)
        log.info("[dry-run] %s", payload)
        return None
    url = f"https://graph.facebook.com/{st.graph_api_version}/{st.phone_number_id}/messages"
    try:
        r = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {st.whatsapp_token}"}, timeout=15)
        if r.status_code >= 400:
            # e.g. error 131030: recipient isn't in the test number's allowed list
            log.error("WhatsApp send failed %s: %s", r.status_code, r.text)
            return None
        return r.json()
    except httpx.HTTPError as e:
        log.error("WhatsApp send error: %s", e)
        return None


def send_text(to: str, body: str) -> Optional[dict]:
    # WhatsApp text messages are limited to 4096 characters.
    return _post({"recipient_type": "individual", "to": to, "type": "text",
                  "text": {"preview_url": False, "body": body[:4096]}})


def send_buttons(to: str, body: str, buttons: list[tuple[str, str]]) -> Optional[dict]:
    """buttons: up to 3 (id, title) pairs; WhatsApp limits titles to 20 characters."""
    rows = [{"type": "reply", "reply": {"id": bid, "title": title[:20]}} for bid, title in buttons[:3]]
    return _post({
        "recipient_type": "individual", "to": to, "type": "interactive",
        "interactive": {"type": "button", "body": {"text": body[:1024]}, "action": {"buttons": rows}},
    })


def mark_read(message_id: str) -> Optional[dict]:
    return _post({"status": "read", "message_id": message_id})
