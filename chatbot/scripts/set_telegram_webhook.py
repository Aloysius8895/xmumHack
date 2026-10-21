"""Registers this service's /telegram/webhook URL with Telegram and prints the
result of getWebhookInfo. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET
from the environment (Replit Secrets) - never prints the token.

Usage:
    python scripts/set_telegram_webhook.py https://<your-deployment-url>
"""
import os
import sys

import httpx

TIMEOUT = 15.0


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/set_telegram_webhook.py https://<your-deployment-url>")
        raise SystemExit(1)

    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    if not token or not secret:
        print("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment first.")
        raise SystemExit(1)

    api = f"https://api.telegram.org/bot{token}"
    webhook_url = f"{sys.argv[1].rstrip('/')}/telegram/webhook"

    r = httpx.post(f"{api}/setWebhook", json={
        "url": webhook_url,
        "secret_token": secret,
        "allowed_updates": ["message", "callback_query"],
    }, timeout=TIMEOUT)
    r.raise_for_status()
    print("setWebhook:", r.json())

    r = httpx.get(f"{api}/getWebhookInfo", timeout=TIMEOUT)
    r.raise_for_status()
    print("getWebhookInfo:", r.json())


if __name__ == "__main__":
    main()
