"""Registers this service's /telegram/webhook URL with Telegram and prints the
result of getWebhookInfo. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET
from the environment (Replit Secrets) - never prints the token.

httpx error messages include the request URL, which contains the bot token, so
failures are reported by hand: only the method name, the status code and
Telegram's "description" field (or the exception class name) are printed.

Usage:
    python scripts/set_telegram_webhook.py https://<your-deployment-url>
"""
import os
import re
import sys

import httpx

TIMEOUT = 15.0
TOKEN_FORMAT = re.compile(r"^\d+:[A-Za-z0-9_-]{30,}$")


def _call(method: str, send) -> dict:
    """Run one Telegram API call; on any failure print a token-free message and exit."""
    try:
        r = send()
    except httpx.HTTPError as e:
        print(f"{method} failed: {type(e).__name__}")
        raise SystemExit(1)

    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code != 200:
        description = body.get("description", "") if isinstance(body, dict) else ""
        print(f"{method} failed: HTTP {r.status_code} {description}".rstrip())
        raise SystemExit(1)
    return body


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/set_telegram_webhook.py https://<your-deployment-url>")
        raise SystemExit(1)

    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    if not token or not secret:
        print("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment first.")
        raise SystemExit(1)
    if not TOKEN_FORMAT.match(token):
        print("TELEGRAM_BOT_TOKEN looks incomplete (expected <bot id>:<secret>)")
        raise SystemExit(1)

    api = f"https://api.telegram.org/bot{token}"
    webhook_url = f"{sys.argv[1].rstrip('/')}/telegram/webhook"

    body = _call("setWebhook", lambda: httpx.post(f"{api}/setWebhook", json={
        "url": webhook_url,
        "secret_token": secret,
        "allowed_updates": ["message", "callback_query"],
    }, timeout=TIMEOUT))
    print("setWebhook:", body)

    body = _call("getWebhookInfo", lambda: httpx.get(f"{api}/getWebhookInfo", timeout=TIMEOUT))
    print("getWebhookInfo:", body)


if __name__ == "__main__":
    main()
