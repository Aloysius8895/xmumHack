"""Channel-agnostic message handling shared by WhatsApp and Telegram: routing
(report / chat / uncertain), the allowlist, the CareerSphere /chat call, saving
reports, and the reply text. Only receiving and sending are channel-specific -
see app/whatsapp_channel.py and app/telegram_channel.py."""
import logging
from dataclasses import dataclass
from typing import Callable, Optional

from . import ai, career_api, classify, db
from .config import get_settings

log = logging.getLogger("whatsapp")

RESET_WORDS = {"重新开始", "清除对话", "reset", "/reset", "restart"}
FALLBACK = "抱歉，我现在有点忙不过来 🙏 请稍后再发一次。\nSorry, I can't reply right now. Please try again in a moment."
NON_TEXT = "目前只支持文字消息哦 📝\nI can only read text messages for now."
CONFIRM_PROMPT = "要把这条记成学习记录吗？\nShould I log this as a study record?"
NOT_LOGGED = "好的，这条没有记录 👍\nOkay, not logged."
NO_PENDING = "这条已经处理过了，请直接发新消息 🙏\nThat one's already handled - just send a new message."
AUTH_ERROR = "系统设定有问题，请稍后再试 🙏\nSomething's misconfigured on our end, please try again later."
TEMP_FAIL = "记录暂时失败，请稍后再发一次 🙏\nCouldn't save that just now - please send it again in a moment."
DEMO_NOTE = "（demo：进度记录目前只开放给测试号码 / progress logging is demo-only for test numbers）"
_AUTH_FAIL_CODES = {"unauthorized", "service-unavailable"}


@dataclass(frozen=True)
class Channel:
    """How the shared handling talks back to a specific messaging channel."""
    name: str  # "whatsapp" | "telegram" - also the CareerSphere API's "channel" field
    send_text: Callable[[str, str], None]
    send_buttons: Callable[[str, str, list[tuple[str, str]]], None]


def handle_text(channel: Channel, uid: str, raw_id: str, text: str) -> None:
    """uid: this user's key in the db and the CareerSphere "from" field (channel-
    prefixed for Telegram). raw_id: the channel's own id, checked against its
    allowlist."""
    text = text.strip()
    if not text:
        return
    if text.lower() in RESET_WORDS:
        db.clear_history(uid)
        db.pop_pending(uid)
        channel.send_text(uid, "好的，我们重新开始 👋\nOkay, fresh start!")
        return

    result = classify.classify_message(text)
    kind, lang = result["type"], result["lang"]

    if kind == "report":
        if _is_allowed(channel, raw_id):
            _submit_report(channel, uid, text, lang)
        else:
            _handle_chat(channel, uid, text, extra_note=DEMO_NOTE)
        return

    if kind == "uncertain":
        if _is_allowed(channel, raw_id):
            db.set_pending(uid, text, lang)
            channel.send_buttons(uid, CONFIRM_PROMPT, [("report_yes", "记录 Log"), ("report_no", "聊聊 Chat")])
        else:
            _handle_chat(channel, uid, text)
        return

    _handle_chat(channel, uid, text)


def handle_button(channel: Channel, uid: str, button_id: str) -> None:
    if button_id not in {"report_yes", "report_no"}:
        return
    pending = db.pop_pending(uid)
    if not pending:
        channel.send_text(uid, NO_PENDING)
        return
    if button_id == "report_yes":
        _submit_report(channel, uid, pending["text"], pending["lang"])
    else:
        db.add_message(uid, "user", pending["text"])
        db.add_message(uid, "assistant", NOT_LOGGED)
        channel.send_text(uid, NOT_LOGGED)


def _is_allowed(channel: Channel, raw_id: str) -> bool:
    st = get_settings()
    allowed = st.allowed_wa_ids if channel.name == "whatsapp" else st.allowed_tg_ids
    return not allowed or raw_id in allowed


def _submit_report(channel: Channel, uid: str, text: str, lang: str) -> None:
    try:
        result = career_api.chat(text, lang, uid, channel=channel.name)
    except career_api.CareerAPIError as e:
        log.error("career_api.chat failed for %s: %s", uid, e.code)
        channel.send_text(uid, AUTH_ERROR if e.code in _AUTH_FAIL_CODES else TEMP_FAIL)
        return

    log_entry = result.get("log")
    reply_text = result.get("reply") or FALLBACK
    if log_entry:
        db.save_report(uid, text, log_entry.get("summary"), log_entry.get("skillIds") or [],
                        log_entry.get("advanced") or [], log_entry.get("points"))
    db.add_message(uid, "user", text)
    db.add_message(uid, "assistant", reply_text)
    channel.send_text(uid, reply_text)


def _handle_chat(channel: Channel, uid: str, text: str, extra_note: Optional[str] = None) -> None:
    db.add_message(uid, "user", text)
    history = db.history(uid, get_settings().history_turns)
    try:
        answer = ai.reply(history)
    except Exception:
        log.exception("AI reply failed")
        channel.send_text(uid, FALLBACK)
        return
    if not answer:
        channel.send_text(uid, FALLBACK)
        return
    if extra_note:
        answer = f"{answer}\n{extra_note}"
    db.add_message(uid, "assistant", answer)
    channel.send_text(uid, answer)
