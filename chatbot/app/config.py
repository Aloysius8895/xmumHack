"""Settings from environment variables (Replit Secrets). Nothing secret is hard-coded."""
import os
from dataclasses import dataclass


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _id_set(name: str) -> frozenset[str]:
    raw = os.getenv(name, "")
    return frozenset(p.strip() for p in raw.split(",") if p.strip())


@dataclass(frozen=True)
class Settings:
    whatsapp_token: str
    phone_number_id: str
    app_secret: str
    verify_token: str
    graph_api_version: str
    db_path: str
    history_turns: int   # how many past messages the AI sees per user
    dry_run: bool        # True = don't call WhatsApp, just record outgoing messages
    careersphere_api_url: str
    integration_token: str
    allowed_wa_ids: frozenset[str]   # empty = no restriction (local testing)
    cron_token: str
    digest_schedule_enabled: bool
    telegram_bot_token: str
    telegram_webhook_secret: str
    allowed_tg_ids: frozenset[str]   # empty = no restriction (local testing)


def get_settings() -> Settings:
    token = os.getenv("WHATSAPP_TOKEN", "")
    return Settings(
        whatsapp_token=token,
        phone_number_id=os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
        app_secret=os.getenv("WHATSAPP_APP_SECRET", ""),
        verify_token=os.getenv("WHATSAPP_VERIFY_TOKEN", ""),
        graph_api_version=os.getenv("GRAPH_API_VERSION", "v23.0"),
        db_path=os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "chat.db")),
        history_turns=int(os.getenv("HISTORY_TURNS", "20")),
        dry_run=_bool("WHATSAPP_DRY_RUN", default=not token),
        careersphere_api_url=os.getenv("CAREERSPHERE_API_URL", "").rstrip("/"),
        integration_token=os.getenv("INTEGRATION_TOKEN", ""),
        allowed_wa_ids=_id_set("ALLOWED_WA_IDS"),
        cron_token=os.getenv("CRON_TOKEN", ""),
        digest_schedule_enabled=_bool("DIGEST_SCHEDULE_ENABLED", default=False),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        telegram_webhook_secret=os.getenv("TELEGRAM_WEBHOOK_SECRET", ""),
        allowed_tg_ids=_id_set("TELEGRAM_ALLOWED_USER_IDS"),
    )
