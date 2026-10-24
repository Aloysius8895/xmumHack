"""Every fixed user-facing message lives in app/messages.py, in English for
now. Malay ("ms") / Chinese ("zh") can be added later as new dicts with the
same keys - this just checks the "en" set and the t() helper."""
from app import messages

_KEYS = [
    "reset_reply", "fallback", "non_text", "confirm_prompt", "confirm_yes_label",
    "confirm_no_label", "not_logged", "no_pending", "auth_error", "temp_fail",
    "demo_note", "welcome",
]


def test_every_key_has_english_text():
    for key in _KEYS:
        assert messages.MESSAGES["en"][key]


def test_only_english_is_filled_in_so_far():
    assert set(messages.MESSAGES) == {"en"}


def test_t_looks_up_english():
    assert messages.t("reset_reply") == messages.MESSAGES["en"]["reset_reply"]


def test_t_formats_kwargs():
    assert messages.t("welcome", uid=123456789).count("123456789") == 1


def test_confirm_button_labels_are_short():
    assert messages.t("confirm_yes_label") == "Yes"
    assert messages.t("confirm_no_label") == "No"
    assert len(messages.t("confirm_yes_label")) <= 20
    assert len(messages.t("confirm_no_label")) <= 20
