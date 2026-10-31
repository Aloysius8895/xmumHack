"""Telegram receiving/sending: parses Bot API updates and talks to the Bot
API. All routing logic lives in app/handlers.py.

Only private chats are handled; group/channel updates are ignored. "/start"
is answered directly (not routed through handlers) so we can show the user
their numeric Telegram id for the allowlist."""
import logging

from . import career_api, db, handlers, messages, expert
from .config import get_settings
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

    command = text.strip().split(maxsplit=1)[0].split("@", 1)[0].lower() if text.strip() else ""
    if command == "/start":
        db.clear_expert_session(_uid(user_id))
        tg.send_message(chat["id"], messages.t("welcome", uid=user_id))
        return

    if command == "/quiz":
        if not _quiz_owner(_uid(user_id)):
            return
        try:
            current = career_api.log_quiz(_uid(user_id), action="current")
            if current.get("quiz"):
                show_log_quiz(_uid(user_id), current["quiz"])
            else:
                _send_text(_uid(user_id), "Send what you learned today to start a two-question check.")
        except career_api.CareerAPIError:
            _send_text(_uid(user_id), "Quiz service unavailable. Please try again later.")
        return

    if command == "/reset":
        text = "/reset"
    if expert.handle_text(CHANNEL, _uid(user_id), str(user_id), text):
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
    if data.startswith("logquiz:"):
        if not chat or chat.get("type") != "private" or str(chat.get("id")) != str(user_id):
            return
        _quiz_answer(_uid(user_id), data)
        return
    handlers.handle_button(CHANNEL, _uid(user_id), data)


def _quiz_owner(uid: str) -> bool:
    if get_settings().allowed_tg_ids == frozenset({uid.removeprefix("tg:")}):
        return True
    _send_text(uid, "Quiz access requires this Telegram ID to be the sole linked game owner.")
    return False


def show_log_quiz(uid: str, quiz: dict) -> None:
    buttons = [(f"logquiz:{quiz['id']}:{quiz['step']}:{index}", option[:60]) for index, option in enumerate(quiz["options"])]
    _send_buttons(uid, f"Question {quiz['step'] + 1}/{quiz['total']}\n{quiz['question']}", buttons)


def _quiz_answer(uid: str, data: str) -> None:
    if not _quiz_owner(uid):
        return
    parts = data.split(":")
    if len(parts) != 4 or not parts[2].isdigit() or not parts[3].isdigit():
        return
    try:
        result = career_api.log_quiz(uid, action="submit", quizId=parts[1], step=int(parts[2]), optionIndex=int(parts[3]))
        if result.get("next"):
            show_log_quiz(uid, result["quiz"])
        elif result.get("passed"):
            _send_text(uid, "Verified. Your learning log and game progress are saved.")
        else:
            _send_text(uid, "Not passed. Review your work and send a new learning log to retry.")
    except career_api.CareerAPIError as error:
        _send_text(uid, "This answer has expired. Send a new learning log." if error.code == "log-quiz-stale" else "Quiz service unavailable. Please try again later.")
