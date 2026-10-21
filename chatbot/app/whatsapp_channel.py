"""WhatsApp receiving/sending: parses Meta's webhook payload and talks to the
Cloud API. All routing logic lives in app/handlers.py."""
import logging

from . import db, handlers
from . import whatsapp_api as wa

log = logging.getLogger("chatbot")

CHANNEL = handlers.Channel(name="whatsapp", send_text=wa.send_text, send_buttons=wa.send_buttons)


def handle_payload(payload: dict) -> None:
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for msg in change.get("value", {}).get("messages", []):
                try:
                    handle_message(msg)
                except Exception:
                    log.exception("failed to handle message %s", msg.get("id"))
            # change["value"]["statuses"] (sent / delivered / read) are ignored.


def handle_message(msg: dict) -> None:
    wa_id, mid = msg.get("from"), msg.get("id")
    if not wa_id or not mid or not db.mark_seen(mid):
        return  # malformed or a duplicate delivery
    wa.mark_read(mid)

    if msg.get("type") == "interactive":
        button_id = ((msg.get("interactive") or {}).get("button_reply") or {}).get("id")
        if button_id:
            handlers.handle_button(CHANNEL, wa_id, button_id)
        return

    if msg.get("type") != "text":
        wa.send_text(wa_id, handlers.NON_TEXT)
        return

    handlers.handle_text(CHANNEL, wa_id, wa_id, msg["text"].get("body", ""))
