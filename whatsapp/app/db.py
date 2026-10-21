"""SQLite storage: per-user chat history and handled message ids."""
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from .config import get_settings

_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_id       TEXT NOT NULL,
    role        TEXT NOT NULL,          -- 'user' or 'assistant'
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_wa ON messages(wa_id, id);

-- Meta can deliver the same message twice; remember what was handled.
CREATE TABLE IF NOT EXISTS seen_messages (
    wa_message_id TEXT PRIMARY KEY,
    seen_at       TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


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
