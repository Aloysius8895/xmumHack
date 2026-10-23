"""SQLite storage: per-user chat history, handled message ids, learning reports
and pending report confirmations."""
import json
import sqlite3
import threading
from contextvars import ContextVar
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional
from zoneinfo import ZoneInfo

from .config import get_settings

_lock = threading.Lock()
MYT = ZoneInfo("Asia/Kuala_Lumpur")
CURRENT_EVENT = ContextVar("chatbot_delivery_event", default=None)

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_id       TEXT NOT NULL,
    role        TEXT NOT NULL,          -- 'user' or 'assistant'
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_wa ON messages(wa_id, id);

-- Meta/Telegram can deliver the same message/update twice; remember what was
-- handled. Shared by every channel - Telegram's integer update_id is stored
-- stringified and prefixed ("tg:<update_id>") to avoid clashing with WhatsApp's.
CREATE TABLE IF NOT EXISTS seen_messages (
    wa_message_id TEXT PRIMARY KEY,
    seen_at       TEXT NOT NULL
);

-- Successful /api/integrations/chat reports, kept for the daily digest.
CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_date     TEXT NOT NULL,          -- YYYY-MM-DD in Asia/Kuala_Lumpur
    wa_id       TEXT NOT NULL,
    text        TEXT NOT NULL,
    summary     TEXT,
    skill_ids   TEXT NOT NULL,          -- JSON list
    advanced    TEXT NOT NULL,          -- JSON list
    points      INTEGER,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(wa_date);

CREATE TABLE IF NOT EXISTS report_events (
    event_id TEXT PRIMARY KEY
);

-- "Is this a learning report?" waiting on the user's button tap. One per number.
CREATE TABLE IF NOT EXISTS pending_confirmations (
    wa_id       TEXT PRIMARY KEY,
    text        TEXT NOT NULL,
    lang        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def today_myt() -> str:
    return datetime.now(MYT).strftime("%Y-%m-%d")


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    path = Path(get_settings().db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def mark_seen(wa_message_id: str) -> bool:
    """Returns False if this message id was already handled."""
    with connect() as conn:
        cur = conn.execute("INSERT OR IGNORE INTO seen_messages VALUES (?, ?)", (wa_message_id, _now()))
        return cur.rowcount == 1


def forget_seen(message_id: str) -> None:
    """Release a failed delivery so an n8n retry can attempt processing again."""
    with connect() as conn:
        conn.execute("DELETE FROM seen_messages WHERE wa_message_id = ?", (message_id,))


def add_message(wa_id: str, role: str, content: str) -> None:
    with connect() as conn:
        conn.execute("INSERT INTO messages (wa_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                     (wa_id, role, content, _now()))


def history(wa_id: str, limit: int) -> list[dict]:
    """Last `limit` messages for this number, oldest first."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE wa_id = ? ORDER BY id DESC LIMIT ?", (wa_id, limit)
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def clear_history(wa_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM messages WHERE wa_id = ?", (wa_id,))


def save_report(wa_id: str, text: str, summary: Optional[str], skill_ids: list[str],
                 advanced: list[dict], points: Optional[int]) -> None:
    with connect() as conn:
        event_id = CURRENT_EVENT.get()
        if event_id and conn.execute("INSERT OR IGNORE INTO report_events VALUES (?)", (event_id,)).rowcount == 0:
            return
        conn.execute(
            "INSERT INTO reports (wa_date, wa_id, text, summary, skill_ids, advanced, points, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (today_myt(), wa_id, text, summary, json.dumps(skill_ids), json.dumps(advanced), points, _now()),
        )


def reports_for_date(wa_date: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT wa_id, text, summary, skill_ids, advanced, points FROM reports WHERE wa_date = ? ORDER BY id",
            (wa_date,),
        ).fetchall()
    return [
        {
            "wa_id": r["wa_id"], "text": r["text"], "summary": r["summary"],
            "skill_ids": json.loads(r["skill_ids"]), "advanced": json.loads(r["advanced"]), "points": r["points"],
        }
        for r in rows
    ]


def set_pending(wa_id: str, text: str, lang: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO pending_confirmations (wa_id, text, lang, created_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(wa_id) DO UPDATE SET text = excluded.text, lang = excluded.lang, "
            "created_at = excluded.created_at",
            (wa_id, text, lang, _now()),
        )


def pop_pending(wa_id: str) -> Optional[dict]:
    """Returns and deletes the pending confirmation for this number, if any."""
    with connect() as conn:
        row = conn.execute(
            "SELECT text, lang FROM pending_confirmations WHERE wa_id = ?", (wa_id,)
        ).fetchone()
        if not row:
            return None
        conn.execute("DELETE FROM pending_confirmations WHERE wa_id = ?", (wa_id,))
        return {"text": row["text"], "lang": row["lang"]}
