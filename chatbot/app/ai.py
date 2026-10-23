"""The chat AI with an explicit provider selection.

Replit AI Integrations (paid Replit plans) sets these environment variables
automatically once enabled for the app, so no personal API key is needed:

  Anthropic (Claude):  AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  OpenAI (GPT):        AI_INTEGRATIONS_OPENAI_API_KEY,    AI_INTEGRATIONS_OPENAI_BASE_URL

Your own keys (ANTHROPIC_API_KEY / OPENAI_API_KEY) also work and take priority.
Pick the provider with AI_PROVIDER and the model with AI_MODEL; otherwise the
first configured provider is used.
"""
import os
import re
from typing import Optional

SYSTEM_PROMPT = """You are the CareerSphere companion, chatting with a learner over chat (WhatsApp or Telegram).
CareerSphere helps people find future-ready careers and prepare for them by self-study.

How to reply:
- Short, friendly chat messages: a few sentences.
- Plain text only - no Markdown. Do not use **bold**, __underline__, or # headings. Simple "- " bullet
  points are fine if you need a short list.
- Reply in the language the user writes in (Chinese, English or Malay).
- Encourage the user, help them reflect on what they studied and plan the next small step.
- You support the user's own decisions; you do not decide for them.
- Never invent jobs, courses, statistics, salaries or company facts. If you are not sure, say so
  and suggest the user check the CareerSphere app or an official source.
- You can't see the user's profile, roadmap or progress yet, so don't pretend to know them.
"""

_HEADING_PREFIX = re.compile(r"^[ \t]*#{1,6}[ \t]*", re.MULTILINE)


def strip_markdown(text: str) -> str:
    """Removes common Markdown markers the model sometimes uses despite the
    system prompt - **bold**, __underline__, and leading '#' headings - so
    channels that render plain text (Telegram, WhatsApp) show the words
    instead of the raw punctuation. "- " bullet points are left alone."""
    text = text.replace("**", "").replace("__", "")
    return _HEADING_PREFIX.sub("", text)

DEFAULT_MODELS = {"anthropic": "claude-haiku-4-5", "openai": "gpt-5-mini"}
AWS_PROVIDERS = {"bedrock", "deepseek_direct"}


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
    if chosen in AWS_PROVIDERS | {"anthropic", "openai"}:
        return chosen
    if os.getenv("AWS_BACKEND_URL") and os.getenv("AWS_BACKEND_TOKEN"):
        return "bedrock"
    if _anthropic_creds():
        return "anthropic"
    if _openai_creds():
        return "openai"
    return None


def model_name() -> Optional[str]:
    p = provider()
    if p in AWS_PROVIDERS:
        return "configured-in-aws"
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
    return _complete(_normalise(history), system=SYSTEM_PROMPT)


def complete(prompt: str) -> str:
    """One-off instruction-following call (no conversation history, no companion persona).
    Used for small utility tasks like message classification."""
    return _complete([{"role": "user", "content": prompt}], system=None)


def _complete(messages: list[dict], system: Optional[str]) -> str:
    p = provider()
    model = model_name()

    if p in AWS_PROVIDERS:
        from . import aws_backend
        try:
            return aws_backend.complete(p, messages, system, max_tokens=600)
        except aws_backend.AwsBackendError as exc:
            raise RuntimeError(exc.code) from exc

    if p == "anthropic":
        creds = _anthropic_creds()
        if not creds:
            raise RuntimeError("Anthropic selected but no credentials found")
        from anthropic import Anthropic
        client = Anthropic(api_key=creds[0], base_url=creds[1]) if creds[1] else Anthropic(api_key=creds[0])
        kwargs = {"model": model, "max_tokens": 600, "messages": messages}
        if system:
            kwargs["system"] = system
        resp = client.messages.create(**kwargs)
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()

    if p == "openai":
        creds = _openai_creds()
        if not creds:
            raise RuntimeError("OpenAI selected but no credentials found")
        from openai import OpenAI
        client = OpenAI(api_key=creds[0], base_url=creds[1]) if creds[1] else OpenAI(api_key=creds[0])
        full_messages = [{"role": "system", "content": system}, *messages] if system else messages
        resp = client.chat.completions.create(model=model, messages=full_messages)
        return (resp.choices[0].message.content or "").strip()

    raise RuntimeError("No AI configured: enable Replit AI Integrations or set an API key")
