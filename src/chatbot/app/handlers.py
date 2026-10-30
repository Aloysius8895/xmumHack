"""Channel-agnostic message handling shared by WhatsApp and Telegram: routing
(report / chat / uncertain), the allowlist, the CareerSphere /chat call, saving
reports, and the reply text. Only receiving and sending are channel-specific -
see app/whatsapp_channel.py and app/telegram_channel.py."""
import logging
from dataclasses import dataclass
from typing import Callable, Optional

from . import ai, career_api, classify, db, messages
from .config import get_settings

log = logging.getLogger("chatbot")

RESET_WORDS = {"重新开始", "清除对话", "reset", "/reset", "restart"}
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
    command = text.split(maxsplit=1)[0].split("@", 1)[0].lower()
    if text.lower() in RESET_WORDS or command == "/reset":
        db.clear_history(uid)
        db.pop_pending(uid)
        channel.send_text(uid, messages.t("reset_reply"))
        return

    result = classify.classify_message(text)
    kind, lang = result["type"], result["lang"]

    if kind == "report":
        if _is_allowed(channel, raw_id):
            _submit_report(channel, uid, text, lang)
        else:
            _handle_chat(channel, uid, text, extra_note=messages.t("demo_note"))
        return

    if kind == "uncertain":
        if _is_allowed(channel, raw_id):
            db.set_pending(uid, text, lang)
            channel.send_buttons(uid, messages.t("confirm_prompt"),
                                  [("report_yes", messages.t("confirm_yes_label")),
                                   ("report_no", messages.t("confirm_no_label"))])
        else:
            _handle_chat(channel, uid, text)
        return

    _handle_chat(channel, uid, text)


def handle_button(channel: Channel, uid: str, button_id: str) -> None:
    if button_id not in {"report_yes", "report_no"}:
        return
    if not _is_allowed(channel, uid.removeprefix("tg:")):
        channel.send_text(uid, messages.t("demo_note"))
        return
    pending = db.pop_pending(uid)
    if not pending:
        channel.send_text(uid, messages.t("no_pending"))
        return
    if button_id == "report_yes":
        _submit_report(channel, uid, pending["text"], pending["lang"])
    else:
        not_logged = messages.t("not_logged")
        db.add_message(uid, "user", pending["text"])
        db.add_message(uid, "assistant", not_logged)
        channel.send_text(uid, not_logged)


def _is_allowed(channel: Channel, raw_id: str) -> bool:
    st = get_settings()
    allowed = st.allowed_wa_ids if channel.name == "whatsapp" else st.allowed_tg_ids
    return not allowed or raw_id in allowed


def _submit_report(channel: Channel, uid: str, text: str, lang: str) -> None:
    try:
        result = career_api.chat(text, lang, uid, channel=channel.name)
    except career_api.CareerAPIError as e:
        log.error("career_api.chat failed for %s: %s", uid, e.code)
        channel.send_text(uid, messages.t("auth_error") if e.code in _AUTH_FAIL_CODES else messages.t("temp_fail"))
        return

    log_entry = result.get("log")
    reply_text = result.get("reply") or messages.t("fallback")
    if log_entry and log_entry.get("verdict", "learned") == "learned":
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
        channel.send_text(uid, messages.t("fallback"))
        return
    if not answer:
        channel.send_text(uid, messages.t("fallback"))
        return
    # Telegram/WhatsApp render plain text, but the model sometimes replies with
    # Markdown anyway (despite the system prompt) - strip it before sending.
    answer = ai.strip_markdown(answer)
    if extra_note:
        answer = f"{answer}\n\n{extra_note}"
    db.add_message(uid, "assistant", answer)
    channel.send_text(uid, answer)
