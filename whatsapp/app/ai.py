"""The chat AI, served through Replit AI Integrations.

Replit AI Integrations (paid Replit plans) sets these environment variables
automatically once enabled for the app, so no personal API key is needed:

  Anthropic (Claude):  AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  OpenAI (GPT):        AI_INTEGRATIONS_OPENAI_API_KEY,    AI_INTEGRATIONS_OPENAI_BASE_URL

Your own keys (ANTHROPIC_API_KEY / OPENAI_API_KEY) also work and take priority.
Pick the provider with AI_PROVIDER and the model with AI_MODEL; otherwise the
first configured provider is used.
"""
import os
from typing import Optional

SYSTEM_PROMPT = """You are the CareerSphere companion, chatting with a learner on WhatsApp.
CareerSphere helps people find future-ready careers and prepare for them by self-study.

How to reply:
- Short, friendly WhatsApp messages: a few sentences, no markdown headings or tables.
- Reply in the language the user writes in (Chinese, English or Malay).
- Encourage the user, help them reflect on what they studied and plan the next small step.
- You support the user's own decisions; you do not decide for them.
- Never invent jobs, courses, statistics, salaries or company facts. If you are not sure, say so
  and suggest the user check the CareerSphere app or an official source.
- You can't see the user's profile, roadmap or progress yet, so don't pretend to know them.
"""

DEFAULT_MODELS = {"anthropic": "claude-haiku-4-5", "openai": "gpt-5-mini"}


def _anthropic_creds() -> Optional[tuple[str, Optional[str]]]:
    if os.getenv("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"], os.getenv("ANTHROPIC_BASE_URL")
    if os.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY"):
        return os.environ["AI_INTEGRATIONS_ANTHROPIC_API_KEY"], os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL")
    return None


def _openai_creds() -> Optional[tuple[str, Optional[str]]]:
    if os.getenv("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"], os.getenv("OPENAI_BASE_URL")
    if os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY"):
        return os.environ["AI_INTEGRATIONS_OPENAI_API_KEY"], os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL")
    return None


def provider() -> Optional[str]:
    """Which provider will answer: AI_PROVIDER if set, else the first one with credentials."""
    chosen = os.getenv("AI_PROVIDER", "").strip().lower()
    if chosen in {"anthropic", "openai"}:
        return chosen
    if _anthropic_creds():
        return "anthropic"
    if _openai_creds():
        return "openai"
    return None


def model_name() -> Optional[str]:
    p = provider()
    return os.getenv("AI_MODEL") or (DEFAULT_MODELS[p] if p else None)


def _normalise(history: list[dict]) -> list[dict]:
    """Merge consecutive same-role turns and start with the user (required by Anthropic)."""
    out: list[dict] = []
    for m in history:
        if out and out[-1]["role"] == m["role"]:
            out[-1] = {"role": m["role"], "content": out[-1]["content"] + "\n" + m["content"]}
        else:
            out.append(dict(m))
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out


def reply(history: list[dict]) -> str:
    """history: [{"role": "user"|"assistant", "content": str}, ...] ending with the user's message."""
    messages = _normalise(history)
    p = provider()
    model = model_name()

    if p == "anthropic":
        creds = _anthropic_creds()
        if not creds:
            raise RuntimeError("Anthropic selected but no credentials found")
        from anthropic import Anthropic
        client = Anthropic(api_key=creds[0], base_url=creds[1]) if creds[1] else Anthropic(api_key=creds[0])
        resp = client.messages.create(model=model, max_tokens=600, system=SYSTEM_PROMPT, messages=messages)
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()

    if p == "openai":
        creds = _openai_creds()
        if not creds:
            raise RuntimeError("OpenAI selected but no credentials found")
        from openai import OpenAI
        client = OpenAI(api_key=creds[0], base_url=creds[1]) if creds[1] else OpenAI(api_key=creds[0])
        resp = client.chat.completions.create(
            model=model, messages=[{"role": "system", "content": SYSTEM_PROMPT}, *messages])
        return (resp.choices[0].message.content or "").strip()

    raise RuntimeError("No AI configured: enable Replit AI Integrations or set an API key")
