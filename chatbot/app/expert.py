"""Telegram expert mode. Conversation state is separate from learning reports and casual chat."""
import logging
import threading

from . import ai, career_api, db, messages
from .config import get_settings
from .handlers import RESET_WORDS

log = logging.getLogger("chatbot")
_lock = threading.RLock()  # This project binds one Telegram owner to one web-game save.


def handle_text(channel, uid: str, raw_id: str, text: str) -> bool:
    text = text.strip()
    if not text:
        return False
    command = text.split(maxsplit=1)[0].split("@", 1)[0].lower() if text else ""
    with _lock:
        if text.lower() in RESET_WORDS or command in {"/start", "/reset"}:
            db.clear_expert_session(uid)
            return False
        if command == "/exit":
            db.clear_expert_session(uid)
            db.pop_pending(uid)
            channel.send_text(uid, messages.t("expert_exit"))
            return True

        owner_bound = get_settings().allowed_tg_ids == frozenset({raw_id})
        if not owner_bound:
            if command == "/expert":
                channel.send_text(uid, messages.t("expert_owner"))
                return True
            return False

        session = db.get_expert_session(uid)
        if command != "/expert" and session is None:
            return False
        if text.startswith("/") and command != "/expert":
            channel.send_text(uid, messages.t("expert_help"))
            return True

        try:
            result = career_api.expert("" if command == "/expert" else text, uid, "enter" if command == "/expert" else "ask", session=session)
            if not isinstance(result.get("active"), bool) or not isinstance(result.get("reply"), str) or not result["reply"].strip():
                raise ValueError("Invalid expert response")
            if result["active"]:
                db.set_expert_session(uid, result)
            else:
                db.clear_expert_session(uid)
            db.pop_pending(uid)
            channel.send_text(uid, ai.strip_markdown(result["reply"]))
        except career_api.CareerAPIError as error:
            log.error("Expert request failed: %s", error.code)
            channel.send_text(uid, messages.t("expert_unavailable"))
        except Exception:
            log.exception("Expert request failed")
            channel.send_text(uid, messages.t("expert_unavailable"))
        return True
