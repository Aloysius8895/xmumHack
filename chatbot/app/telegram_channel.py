"""Telegram receiving/sending: parses Bot API updates and talks to the Bot
API. All routing logic lives in app/handlers.py.

Only private chats are handled; group/channel updates are ignored. "/start"
is answered directly (not routed through handlers) so we can show the user
their numeric Telegram id for the allowlist."""
import logging

from . import db, handlers, messages
from . import telegram_api as tg

log = logging.getLogger("chatbot")


def _uid(user_id: int) -> str:
    return f"tg:{user_id}"


def _send_text(uid: str, body: str) -> None:
    tg.send_message(uid.removeprefix("tg:"), body)


def _send_buttons(uid: str, body: str, buttons: list[tuple[str, str]]) -> None:
    tg.send_inline_keyboard(uid.removeprefix("tg:"), body, buttons)


CHANNEL = handlers.Channel(name="telegram", send_text=_send_text, send_buttons=_send_buttons)


def handle_update(update: dict) -> None:
    update_id = update.get("update_id")
    if update_id is None or not db.mark_seen(f"tg:{update_id}"):
        return  # malformed or a duplicate delivery

    event = db.CURRENT_EVENT.set(f"tg:{update_id}")
    try:
        _process_update(update)
    except Exception:
        db.forget_seen(f"tg:{update_id}")
        raise
    finally:
        db.CURRENT_EVENT.reset(event)


def _process_update(update: dict) -> None:

    callback_query = update.get("callback_query")
    if callback_query is not None:
        _handle_callback(callback_query)
        return

    message = update.get("message")
    if not message:
        return  # edited_message, channel_post, etc. - not handled

    chat = message.get("chat") or {}
    user_id = (message.get("from") or {}).get("id")
    if chat.get("type") != "private" or user_id is None:
        return  # only private chats are supported

    text = message.get("text")
    if text is None:
        tg.send_message(chat["id"], messages.t("non_text"))
        return

    if text.strip() == "/start":
        tg.send_message(chat["id"], messages.t("welcome", uid=user_id))
        return

    handlers.handle_text(CHANNEL, _uid(user_id), str(user_id), text)


def _handle_callback(cq: dict) -> None:
    tg.answer_callback_query(cq.get("id", ""))
    user_id = (cq.get("from") or {}).get("id")
    chat = (cq.get("message") or {}).get("chat")
    if chat and chat.get("type") != "private":
        return
    data = cq.get("data")
    if user_id is None or not data:
        return
    handlers.handle_button(CHANNEL, _uid(user_id), data)
