"""app.classify: parses the AI's JSON, never raises, falls back sanely."""
import pytest

from app import ai, classify


@pytest.fixture(autouse=True)
def fake_classify():
    """This file tests the real classify_message; don't let conftest's default
    stub (which every other test file relies on) shadow it here."""


def test_parses_clean_json(monkeypatch):
    monkeypatch.setattr(ai, "complete", lambda _: '{"type": "report", "lang": "zh"}')
    assert classify.classify_message("今天学了 SQL") == {"type": "report", "lang": "zh"}


def test_parses_json_with_surrounding_text(monkeypatch):
    monkeypatch.setattr(ai, "complete", lambda _: 'Sure!\n{"type": "chat", "lang": "en"}\nDone.')
    assert classify.classify_message("hi") == {"type": "chat", "lang": "en"}


def test_bad_type_falls_back_to_uncertain(monkeypatch):
    monkeypatch.setattr(ai, "complete", lambda _: '{"type": "maybe", "lang": "en"}')
    assert classify.classify_message("hi")["type"] == "uncertain"


def test_unparsable_output_falls_back_to_uncertain(monkeypatch):
    monkeypatch.setattr(ai, "complete", lambda _: "not json at all")
    result = classify.classify_message("我学了 SQL")
    assert result["type"] == "uncertain"
    assert result["lang"] == "zh"  # heuristic fallback from CJK characters


def test_bad_lang_falls_back_to_heuristic(monkeypatch):
    monkeypatch.setattr(ai, "complete", lambda _: '{"type": "chat", "lang": "fr"}')
    assert classify.classify_message("hello there") == {"type": "chat", "lang": "en"}


def test_ai_exception_falls_back_to_uncertain(monkeypatch):
    def boom(_):
        raise RuntimeError("down")
    monkeypatch.setattr(ai, "complete", boom)
    assert classify.classify_message("saya sudah belajar")["type"] == "uncertain"
