import importlib.util
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "export_legacy.py"
spec = importlib.util.spec_from_file_location("export_legacy", SCRIPT)
exporter = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(exporter)


class LegacyExportTests(unittest.TestCase):
    def make_sources(self, root: Path):
        save_dir = root / "game"
        save_dir.mkdir()
        (save_dir / "save.json").write_text(
            json.dumps({"version": 4, "digests": []}), encoding="utf-8"
        )
        (save_dir / "market.json").write_text('{"history":[]}', encoding="utf-8")
        (save_dir / "trends.json").write_text('{"months":[]}', encoding="utf-8")
        chat_db = root / "chat.db"
        # closing(): sqlite3's own context manager commits but leaves the file open,
        # which Windows then refuses to delete with the temporary directory.
        with closing(sqlite3.connect(chat_db)) as connection, connection:
            connection.executescript("""
                CREATE TABLE messages (id INTEGER PRIMARY KEY, wa_id TEXT, role TEXT, content TEXT, created_at TEXT);
                CREATE TABLE seen_messages (wa_message_id TEXT PRIMARY KEY, seen_at TEXT);
                CREATE TABLE reports (
                    id INTEGER PRIMARY KEY, wa_date TEXT, wa_id TEXT, text TEXT, summary TEXT,
                    skill_ids TEXT, advanced TEXT, points INTEGER, created_at TEXT
                );
                CREATE TABLE report_events (event_id TEXT PRIMARY KEY);
                CREATE TABLE pending_confirmations (wa_id TEXT PRIMARY KEY, text TEXT, lang TEXT, created_at TEXT);
                CREATE TABLE expert_sessions (user_id TEXT PRIMARY KEY, state TEXT NOT NULL);
                INSERT INTO messages VALUES (1, 'tg:1', 'user', 'Studied SQL', '2026-10-20T10:00:00+08:00');
                INSERT INTO seen_messages VALUES ('wamid.1', '2026-10-20T10:01:00+08:00');
                INSERT INTO reports VALUES
                    (1, '2026-10-20', 'tg:1', 'Studied SQL', 'SQL practice', '["sql"]', '[]', 2,
                     '2026-10-20T10:02:00+08:00');
                INSERT INTO report_events VALUES ('event.1');
                INSERT INTO pending_confirmations VALUES
                    ('tg:1', 'confirm', 'en', '2026-10-20T10:03:00+08:00');
                INSERT INTO expert_sessions VALUES
                    ('tg:1', '{"careerId":"data-analyst","lang":"en","history":[]}');
            """)
        return save_dir, chat_db

    def test_export_makes_private_bundle_and_source_backups(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            save_dir, chat_db = self.make_sources(root)
            output = root / "out" / "bundle.json"
            backups = root / "source-backup"
            args = [
                "export_legacy.py", "--save-dir", str(save_dir), "--chat-db", str(chat_db),
                "--output", str(output), "--backup-dir", str(backups),
            ]
            with patch.object(sys, "argv", args):
                self.assertEqual(exporter.main(), 0)

            bundle = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(bundle["chatbot"]["messages"][0]["id"], "legacy-message:1")
            self.assertEqual(bundle["chatbot"]["reports"][0]["skillIds"], ["sql"])
            self.assertEqual(bundle["chatbot"]["reportEvents"], [{"eventId": "event.1"}])
            self.assertEqual(bundle["chatbot"]["expertSessions"], [
                {"userId": "tg:1", "state": {"careerId": "data-analyst", "lang": "en", "history": []}},
            ])
            self.assertTrue((backups / "chatbot.sqlite").is_file())
            self.assertTrue((backups / "game-save.json").is_file())
            if os.name == "posix":  # Windows chmod only toggles read-only
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                self.assertEqual(backups.stat().st_mode & 0o777, 0o700)

    def test_export_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            save_dir, chat_db = self.make_sources(root)
            output = root / "bundle.json"
            output.write_text("existing", encoding="utf-8")
            backups = root / "source-backup"
            args = [
                "export_legacy.py", "--save-dir", str(save_dir), "--chat-db", str(chat_db),
                "--output", str(output), "--backup-dir", str(backups),
            ]
            with patch.object(sys, "argv", args):
                self.assertEqual(exporter.main(), 2)
            self.assertEqual(output.read_text(encoding="utf-8"), "existing")
            self.assertFalse(backups.exists())


if __name__ == "__main__":
    unittest.main()
