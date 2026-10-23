#!/usr/bin/env python3
"""Create a private, versioned JSON export from the existing local game/chatbot stores.

The export is operator-controlled, does not write to AWS, and refuses to
overwrite an existing bundle or backup directory. Use --dry-run first.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SAVE_DIR = ROOT / "GamePlat" / "game" / "server" / "data"
DEFAULT_CHAT_DB = ROOT / "chatbot" / "data" / "chat.db"


def file_hash(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def table_exists(connection: sqlite3.Connection, name: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def rows(connection: sqlite3.Connection, sql: str) -> list[sqlite3.Row]:
    return [dict(row) for row in connection.execute(sql).fetchall()]


def read_chatbot(path: Path) -> dict:
    empty = {
        "messages": [], "seenMessages": [], "reports": [],
        "reportEvents": [], "pendingConfirmations": [], "expertSessions": [],
    }
    if not path.exists():
        return empty
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        data = dict(empty)
        if table_exists(connection, "messages"):
            data["messages"] = [
                {
                    "id": f"legacy-message:{row['id']}",
                    "userId": row["wa_id"],
                    "role": row["role"],
                    "content": row["content"],
                    "createdAt": row["created_at"],
                }
                for row in rows(connection, "SELECT id, wa_id, role, content, created_at FROM messages ORDER BY id")
            ]
        if table_exists(connection, "seen_messages"):
            data["seenMessages"] = [
                {"messageId": row["wa_message_id"], "seenAt": row["seen_at"]}
                for row in rows(connection, "SELECT wa_message_id, seen_at FROM seen_messages ORDER BY seen_at")
            ]
        if table_exists(connection, "reports"):
            data["reports"] = [
                {
                    "id": f"legacy-report:{row['id']}",
                    "eventId": None,
                    "userId": row["wa_id"],
                    "date": row["wa_date"],
                    "text": row["text"],
                    "summary": row["summary"],
                    "skillIds": json.loads(row["skill_ids"]),
                    "advanced": json.loads(row["advanced"]),
                    "points": row["points"],
                    "createdAt": row["created_at"],
                }
                for row in rows(
                    connection,
                    "SELECT id, wa_date, wa_id, text, summary, skill_ids, advanced, points, created_at FROM reports ORDER BY id",
                )
            ]
        if table_exists(connection, "report_events"):
            data["reportEvents"] = [
                {"eventId": row["event_id"]}
                for row in rows(connection, "SELECT event_id FROM report_events ORDER BY event_id")
            ]
        if table_exists(connection, "pending_confirmations"):
            data["pendingConfirmations"] = [
                {
                    "userId": row["wa_id"], "text": row["text"], "lang": row["lang"],
                    "createdAt": row["created_at"],
                }
                for row in rows(connection, "SELECT wa_id, text, lang, created_at FROM pending_confirmations ORDER BY wa_id")
            ]
        if table_exists(connection, "expert_sessions"):
            data["expertSessions"] = [
                {"userId": row["user_id"], "state": json.loads(row["state"])}
                for row in rows(connection, "SELECT user_id, state FROM expert_sessions ORDER BY user_id")
            ]
        return data
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--save-dir", type=Path, default=DEFAULT_SAVE_DIR)
    parser.add_argument("--chat-db", type=Path, default=DEFAULT_CHAT_DB)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    save_path = args.save_dir / "save.json"
    if not save_path.is_file():
        print(f"Missing game save: {save_path}", file=sys.stderr)
        return 2
    save = load_json(save_path, None)
    if not isinstance(save, dict) or not isinstance(save.get("version"), int):
        print("Game save must be a versioned JSON object.", file=sys.stderr)
        return 2

    market = load_json(args.save_dir / "market.json", {"latest": None, "previous": None, "history": []})
    trends = load_json(args.save_dir / "trends.json", {"months": []})
    chatbot = read_chatbot(args.chat_db)
    sources = {
        "save.json": file_hash(save_path),
        "market.json": file_hash(args.save_dir / "market.json"),
        "trends.json": file_hash(args.save_dir / "trends.json"),
        "chat.db": file_hash(args.chat_db),
    }
    bundle = {
        "formatVersion": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": sources,
        "game": {"save": save, "market": market, "trends": trends},
        "chatbot": chatbot,
    }
    counts = {
        "saves": 1,
        "documents": 2,
        "messages": len(chatbot["messages"]),
        "seenMessages": len(chatbot["seenMessages"]),
        "reports": len(chatbot["reports"]),
        "reportEvents": len(chatbot["reportEvents"]),
        "pendingConfirmations": len(chatbot["pendingConfirmations"]),
        "expertSessions": len(chatbot["expertSessions"]),
        "digests": len(save.get("digests", [])),
    }
    rendered = json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    print(json.dumps({
        "dryRun": args.dry_run,
        "counts": counts,
        "sourceSha256": sources,
        "bundleSha256": hashlib.sha256(rendered).hexdigest(),
        "bundleBytes": len(rendered),
    }, ensure_ascii=False, indent=2))
    if len(rendered) > 8_000_000:
        print("Bundle exceeds the Lambda importer's 8 MB limit; use a separately reviewed batched migration.", file=sys.stderr)
        return 2
    if args.dry_run:
        return 0
    if not args.output or not args.backup_dir:
        print("A non-dry-run export requires both --output and --backup-dir.", file=sys.stderr)
        return 2
    if args.output.exists() or args.backup_dir.exists():
        print("Refusing to overwrite the requested bundle or backup directory.", file=sys.stderr)
        return 2
    if not args.chat_db.exists() and chatbot["messages"]:
        print("Internal export error: chatbot data unexpectedly missing.", file=sys.stderr)
        return 2

    args.backup_dir.mkdir(parents=True, mode=0o700)
    os.chmod(args.backup_dir, 0o700)
    for label, source in (
        ("game-save.json", save_path),
        ("game-market.json", args.save_dir / "market.json"),
        ("game-trends.json", args.save_dir / "trends.json"),
        ("chatbot.sqlite", args.chat_db),
    ):
        if source.exists():
            if label == "chatbot.sqlite":
                src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
                dest = sqlite3.connect(args.backup_dir / label)
                try:
                    src.backup(dest)
                finally:
                    dest.close()
                    src.close()
            else:
                shutil.copy2(source, args.backup_dir / label)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("xb") as destination:
        destination.write(rendered)
    os.chmod(args.output, 0o600)
    print(f"Private export written: {args.output}")
    print(f"Read-only source backups written: {args.backup_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
