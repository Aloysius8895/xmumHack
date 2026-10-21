"""What happens to each incoming WhatsApp message: route it to a reset command,
a learning report (CareerSphere /chat), small talk (Replit AI), or a confirm
button when we can't tell which."""
import logging
from typing import Optional

from . import ai, career_api, classify, db
from . import whatsapp_api as wa
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
        _handle_button(wa_id, msg.get("interactive") or {})
        return

    if msg.get("type") != "text":
        wa.send_text(wa_id, NON_TEXT)
        return

    text = msg["text"].get("body", "").strip()
    if not text:
        return
    if text.lower() in RESET_WORDS:
        db.clear_history(wa_id)
        db.pop_pending(wa_id)
        wa.send_text(wa_id, "好的，我们重新开始 👋\nOkay, fresh start!")
        return

    result = classify.classify_message(text)
    kind, lang = result["type"], result["lang"]

    if kind == "report":
        if _is_allowed(wa_id):
            _submit_report(wa_id, text, lang)
        else:
            _handle_chat(wa_id, text, extra_note=DEMO_NOTE)
        return

    if kind == "uncertain":
        if _is_allowed(wa_id):
            db.set_pending(wa_id, text, lang)
            wa.send_buttons(wa_id, CONFIRM_PROMPT, [("report_yes", "记录 Log"), ("report_no", "聊聊 Chat")])
        else:
            _handle_chat(wa_id, text)
        return

    _handle_chat(wa_id, text)


def _handle_button(wa_id: str, interactive: dict) -> None:
    button_id = (interactive.get("button_reply") or {}).get("id")
    if button_id not in {"report_yes", "report_no"}:
        return
    pending = db.pop_pending(wa_id)
    if not pending:
        wa.send_text(wa_id, NO_PENDING)
        return
    if button_id == "report_yes":
        _submit_report(wa_id, pending["text"], pending["lang"])
    else:
        db.add_message(wa_id, "user", pending["text"])
        db.add_message(wa_id, "assistant", NOT_LOGGED)
        wa.send_text(wa_id, NOT_LOGGED)


def _is_allowed(wa_id: str) -> bool:
    allowed = get_settings().allowed_wa_ids
    return not allowed or wa_id in allowed


def _submit_report(wa_id: str, text: str, lang: str) -> None:
    try:
        result = career_api.chat(text, lang, wa_id)
    except career_api.CareerAPIError as e:
        log.error("career_api.chat failed for %s: %s", wa_id, e.code)
        wa.send_text(wa_id, AUTH_ERROR if e.code in _AUTH_FAIL_CODES else TEMP_FAIL)
        return

    log_entry = result.get("log")
    reply_text = result.get("reply") or FALLBACK
    if log_entry:
        db.save_report(wa_id, text, log_entry.get("summary"), log_entry.get("skillIds") or [],
                        log_entry.get("advanced") or [], log_entry.get("points"))
    db.add_message(wa_id, "user", text)
    db.add_message(wa_id, "assistant", reply_text)
    wa.send_text(wa_id, reply_text)


def _handle_chat(wa_id: str, text: str, extra_note: Optional[str] = None) -> None:
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
    if extra_note:
        answer = f"{answer}\n{extra_note}"
    db.add_message(wa_id, "assistant", answer)
    wa.send_text(wa_id, answer)
