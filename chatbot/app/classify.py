"""Classifies an incoming WhatsApp message with Replit AI: is it a learning report,
small talk/a question, or unclear? Also detects which language to reply in.

A separate, cheap AI call from the conversational reply in app/ai.py (JSON-only,
no conversation history).
"""
import json
import logging
import re

from . import ai

log = logging.getLogger("whatsapp")

TYPES = {"report", "chat", "uncertain"}
LANGS = {"zh", "en", "ms"}

PROMPT = """Classify ONE WhatsApp message from a learner using the CareerSphere app.

Decide "type":
- "report": the user is telling you what they practiced, studied or did (past tense,
  e.g. "today I practiced SQL joins for 2 hours", "做完了三道题").
- "chat": small talk, a question, or anything that is not reporting study activity.
- "uncertain": you genuinely cannot tell if it's a report or not.

Decide "lang": the language the user wrote in - "zh", "en" or "ms".

Reply with ONLY a JSON object, no other text: {"type": "report|chat|uncertain", "lang": "zh|en|ms"}

Message: {message}"""

_MALAY_HINTS = re.compile(r"\b(saya|sudah|belajar|hari ini|boleh|tak|nak)\b", re.IGNORECASE)
_CJK = re.compile(r"[一-鿿]")


def _guess_lang(text: str) -> str:
    if _CJK.search(text):
        return "zh"
    if _MALAY_HINTS.search(text):
        return "ms"
    return "en"


def _parse(raw: str, text: str) -> dict:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            kind = data.get("type")
            lang = data.get("lang")
            if kind in TYPES:
                return {"type": kind, "lang": lang if lang in LANGS else _guess_lang(text)}
        except (json.JSONDecodeError, AttributeError):
            pass
    log.warning("classify: could not parse AI output, defaulting to uncertain")
    return {"type": "uncertain", "lang": _guess_lang(text)}


def classify_message(text: str) -> dict:
    """Returns {"type": "report"|"chat"|"uncertain", "lang": "zh"|"en"|"ms"}.
    Never raises: AI failures fall back to "uncertain" so the user gets a confirm
    button instead of a silently dropped report."""
    try:
        raw = ai.complete(PROMPT.replace("{message}", text))
    except Exception:
        log.exception("classify: AI call failed")
        return {"type": "uncertain", "lang": _guess_lang(text)}
    return _parse(raw or "", text)
