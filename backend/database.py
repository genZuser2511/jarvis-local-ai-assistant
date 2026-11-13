"""SQLite local memory for JARVIS"""
import sqlite3
import json
import time
from pathlib import Path
from config import settings


def get_db():
    db = sqlite3.connect(settings.db_path, check_same_thread=False)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    db = get_db()
    cursor = db.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            role        TEXT NOT NULL,
            content     TEXT NOT NULL,
            timestamp   REAL NOT NULL,
            metadata    TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS actions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type TEXT NOT NULL,
            description TEXT NOT NULL,
            parameters  TEXT DEFAULT '{}',
            status      TEXT DEFAULT 'pending',
            result      TEXT,
            requires_approval INTEGER DEFAULT 0,
            approved    INTEGER DEFAULT 0,
            timestamp   REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS screenshots (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filepath    TEXT NOT NULL,
            description TEXT,
            timestamp   REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings_store (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            updated_at  REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type  TEXT NOT NULL,
            message     TEXT NOT NULL,
            data        TEXT DEFAULT '{}',
            timestamp   REAL NOT NULL
        );
    """)
    db.commit()
    db.close()


def save_message(role: str, content: str, metadata: dict = None):
    db = get_db()
    db.execute(
        "INSERT INTO conversations (role, content, timestamp, metadata) VALUES (?, ?, ?, ?)",
        (role, content, time.time(), json.dumps(metadata or {}))
    )
    db.commit()
    db.close()


def get_conversation_history(limit: int = 20) -> list:
    db = get_db()
    rows = db.execute(
        "SELECT role, content, timestamp FROM conversations ORDER BY timestamp DESC LIMIT ?",
        (limit,)
    ).fetchall()
    db.close()
    return [dict(r) for r in reversed(rows)]


def save_action(action_type: str, description: str, parameters: dict = None,
                requires_approval: bool = False) -> int:
    db = get_db()
    cursor = db.execute(
        """INSERT INTO actions (action_type, description, parameters, status, requires_approval, timestamp)
           VALUES (?, ?, ?, 'pending', ?, ?)""",
        (action_type, description, json.dumps(parameters or {}),
         1 if requires_approval else 0, time.time())
    )
    action_id = cursor.lastrowid
    db.commit()
    db.close()
    return action_id


def update_action(action_id: int, status: str, result: str = None):
    db = get_db()
    db.execute(
        "UPDATE actions SET status = ?, result = ? WHERE id = ?",
        (status, result, action_id)
    )
    db.commit()
    db.close()


def approve_action(action_id: int):
    db = get_db()
    db.execute("UPDATE actions SET approved = 1 WHERE id = ?", (action_id,))
    db.commit()
    db.close()


def get_pending_approvals() -> list:
    db = get_db()
    rows = db.execute(
        "SELECT * FROM actions WHERE requires_approval = 1 AND approved = 0 AND status = 'pending' ORDER BY timestamp DESC"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


def log_activity(event_type: str, message: str, data: dict = None):
    db = get_db()
    db.execute(
        "INSERT INTO activity_log (event_type, message, data, timestamp) VALUES (?, ?, ?, ?)",
        (event_type, message, json.dumps(data or {}), time.time())
    )
    db.commit()
    db.close()


def get_recent_activity(limit: int = 50) -> list:
    db = get_db()
    rows = db.execute(
        "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?",
        (limit,)
    ).fetchall()
    db.close()
    return [dict(r) for r in reversed(rows)]


def get_setting(key: str, default=None):
    db = get_db()
    row = db.execute("SELECT value FROM settings_store WHERE key = ?", (key,)).fetchone()
    db.close()
    if row:
        return json.loads(row["value"])
    return default


def save_setting(key: str, value):
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO settings_store (key, value, updated_at) VALUES (?, ?, ?)",
        (key, json.dumps(value), time.time())
    )
    db.commit()
    db.close()
