"""What happens to each incoming WhatsApp message: store it, ask the AI, send the reply."""
import logging

from . import ai, db
from . import whatsapp_api as wa
from .config import get_settings

log = logging.getLogger("whatsapp")

RESET_WORDS = {"重新开始", "清除对话", "reset", "/reset", "restart"}
FALLBACK = "抱歉，我现在有点忙不过来 🙏 请稍后再发一次。\nSorry, I can't reply right now. Please try again in a moment."
NON_TEXT = "目前只支持文字消息哦 📝\nI can only read text messages for now."


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

    if msg.get("type") != "text":
        wa.send_text(wa_id, NON_TEXT)
        return

    text = msg["text"].get("body", "").strip()
    if not text:
        return
    if text.lower() in RESET_WORDS:
        db.clear_history(wa_id)
        wa.send_text(wa_id, "好的，我们重新开始 👋\nOkay, fresh start!")
        return

    db.add_message(wa_id, "user", text)
    history = db.history(wa_id, get_settings().history_turns)
    try:
        answer = ai.reply(history)
    except Exception:
        log.exception("AI reply failed")
        wa.send_text(wa_id, FALLBACK)
        return
    if not answer:
        wa.send_text(wa_id, FALLBACK)
        return
    db.add_message(wa_id, "assistant", answer)
    wa.send_text(wa_id, answer)
