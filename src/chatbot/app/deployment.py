"""Fail fast on Render misconfiguration without disclosing credential values."""
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

from .config import get_settings


def validate_render_settings() -> None:
    if os.getenv('RENDER', '').lower() != 'true':
        return
    st = get_settings()
    missing = [name for name in ('TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET',
                                 'CAREERSPHERE_API_URL', 'INTEGRATION_TOKEN') if not os.getenv(name, '').strip()]
    if missing:
        raise RuntimeError('Render configuration missing: ' + ', '.join(missing))
    url = urlsplit(st.careersphere_api_url)
    host = (url.hostname or '').lower()
    if (url.scheme != 'https' or not host or host in {'localhost', '0.0.0.0', '::1'}
            or host.startswith('127.') or url.username or url.password or url.query or url.fragment):
        raise RuntimeError('CAREERSPHERE_API_URL must be the game service HTTPS URL, not a local address')
    if not re.fullmatch(r'\d+:[A-Za-z0-9_-]{30,}', st.telegram_bot_token):
        raise RuntimeError('TELEGRAM_BOT_TOKEN is incomplete')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,256}', st.telegram_webhook_secret):
        raise RuntimeError('TELEGRAM_WEBHOOK_SECRET must use Telegram-supported characters')
    if len(st.allowed_tg_ids) != 1 or not all(value.isdigit() for value in st.allowed_tg_ids):
        raise RuntimeError('Set exactly one numeric TELEGRAM_ALLOWED_USER_IDS for the shared game owner')
    if os.getenv('AI_PROVIDER') == 'deepseek' and not os.getenv('DEEPSEEK_API_KEY', '').strip():
        raise RuntimeError('DEEPSEEK_API_KEY is required for the selected provider')
    if os.getenv('REQUIRE_PERSISTENT_STORAGE') == '1' and not st.aws_backend_url:
        root = Path(os.getenv('PERSISTENT_DATA_DIR', '/var/data'))
        target = Path(st.db_path)
        if not root.is_absolute() or not root.is_dir() or not target.is_absolute() or not target.is_relative_to(root):
            raise RuntimeError('DB_PATH must be inside the mounted PERSISTENT_DATA_DIR')
