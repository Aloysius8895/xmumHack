"""Minimal client for the official Telegram Bot API, called directly over
HTTPS (no third-party bot framework). Never logs the bot token."""
import logging
from typing import Optional

import httpx

from .config import get_settings

log = logging.getLogger("whatsapp")
TIMEOUT = 15.0


def _post(method: str, payload: dict) -> Optional[dict]:
    st = get_settings()
    if not st.telegram_bot_token:
        log.error("Telegram %s skipped: TELEGRAM_BOT_TOKEN not set", method)
        return None
    url = f"https://api.telegram.org/bot{st.telegram_bot_token}/{method}"
    try:
        r = httpx.post(url, json=payload, timeout=TIMEOUT)
        if r.status_code >= 400:
            log.error("Telegram %s failed %s: %s", method, r.status_code, r.text)
            return None
        return r.json()
    except httpx.HTTPError as e:
        log.error("Telegram %s error: %s", method, e)
        return None


def send_message(chat_id: str, text: str) -> Optional[dict]:
    # Telegram text messages are limited to 4096 characters.
    return _post("sendMessage", {"chat_id": chat_id, "text": text[:4096]})


def send_inline_keyboard(chat_id: str, text: str, buttons: list[tuple[str, str]]) -> Optional[dict]:
    """buttons: (callback_data, label) pairs, one per row."""
    keyboard = [[{"text": label, "callback_data": data}] for data, label in buttons]
    return _post("sendMessage", {
        "chat_id": chat_id, "text": text[:4096],
        "reply_markup": {"inline_keyboard": keyboard},
    })


def answer_callback_query(callback_query_id: str, text: Optional[str] = None) -> Optional[dict]:
    payload = {"callback_query_id": callback_query_id}
    if text:
        payload["text"] = text
    return _post("answerCallbackQuery", payload)
