"""All fixed, user-facing bot text (WhatsApp + Telegram), structured by
language so Malay ("ms") and Chinese ("zh") can be added later just by adding
translation dicts with the same keys - nothing else needs to change. Only
"en" is filled in for now.

NOT in scope here: the AI's own chat replies (language chosen by the model)
and the "reply" text that comes back from POST /api/integrations/chat
(forwarded to the user as-is)."""

MESSAGES = {
    "en": {
        "expert_exit": "Expert mode ended. You can chat or log learning normally again. Send /expert to consult the expert for your web-game target.",
        "expert_owner": "Expert mode reads the single web-game player's target. Ask the admin to bind exactly one Telegram owner in TELEGRAM_ALLOWED_USER_IDS.",
        "expert_help": "Send your question to the expert, /expert to restart with your web-game target, or /exit to return to ordinary chat.",
        "expert_unavailable": "I couldn't reach the expert right now. Please try again, or send /exit to return to ordinary chat.",
        "reset_reply": "Okay, fresh start!",
        "fallback": "Sorry, I can't reply right now. Please try again in a moment.",
        "non_text": "I can only read text messages for now.",
        "confirm_prompt": "Should I log this as a study record?",
        "confirm_yes_label": "Yes",
        "confirm_no_label": "No",
        "not_logged": "Okay, not logged.",
        "no_pending": "That one's already handled - just send a new message.",
        "auth_error": "Something's misconfigured on our end, please try again later.",
        "temp_fail": "Couldn't save that just now - please send it again in a moment.",
        "demo_note": "(Demo note: progress logging is demo-only for test numbers.)",
        # {uid}: the user's numeric Telegram id, for the allowlist.
        "welcome": (
            "Hi! I'm the CareerSphere companion bot.\n"
            "Your Telegram user id: {uid}\n"
            "(Please send this id to the admin to get whitelisted, so your study "
            "progress can be logged.)\n"
            "/expert: meet the expert for your web-game target, then send questions.\n"
            "Send what you learned today, then answer two questions to save your progress.\n"
            "/quiz: reopen a pending check.\n"
            "/exit: leave expert mode. /reset: reset the conversation."
        ),
    },
}


def t(key: str, **kwargs) -> str:
    """Looks up `key` in English - the only language filled in so far."""
    text = MESSAGES["en"][key]
    return text.format(**kwargs) if kwargs else text
