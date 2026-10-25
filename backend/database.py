"""
database.py — Creates and manages the SQLite database connection.

What is SQLite?
  A database that lives in a single file (greencampus.db) in this folder.
  No separate server to install or run — Python handles everything.

What is a "connection"?
  A connection is like opening a phone call to the database.
  We open it when a request arrives and close it when the request is done.
"""

import sqlite3
from pathlib import Path

# The database file will be created here (same folder as this file)
DB_PATH = Path(__file__).parent / "greencampus.db"


def get_connection() -> sqlite3.Connection:
    """Open and return a database connection.
    
    row_factory=sqlite3.Row makes each database row behave like a
    dictionary, so we can access columns by name: row["title"]
    instead of row[2].
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # Better performance for concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")    # Enforce data integrity rules
    return conn


def create_tables():
    """Create all database tables if they don't exist yet, and apply safe migrations."""
    with get_connection() as conn:
        # 1. Existing tickets table (GreenCampus AI core)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                title          TEXT    NOT NULL,
                description    TEXT    NOT NULL,
                category       TEXT    NOT NULL,
                location       TEXT    NOT NULL,
                department     TEXT    NOT NULL DEFAULT 'Unassigned',
                priority       TEXT    NOT NULL DEFAULT 'Medium'
                                       CHECK(priority IN ('High', 'Medium', 'Low')),
                status         TEXT    NOT NULL DEFAULT 'Open'
                                       CHECK(status IN ('Open', 'In Progress', 'Resolved')),
                submitted_by   TEXT    NOT NULL DEFAULT 'Anonymous',
                ai_suggestion  TEXT,
                ai_explanation TEXT,
                ai_action      TEXT,
                created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        """)

        # Safe migration for tickets table
        existing_cols = {
            row["name"] for row in conn.execute("PRAGMA table_info(tickets)").fetchall()
        }
        if "ai_explanation" not in existing_cols:
            conn.execute("ALTER TABLE tickets ADD COLUMN ai_explanation TEXT")
        if "ai_action" not in existing_cols:
            conn.execute("ALTER TABLE tickets ADD COLUMN ai_action TEXT")

        # 2. Campus Connect: Student profiles
        conn.execute("""
            CREATE TABLE IF NOT EXISTS student_profiles (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                department  TEXT    NOT NULL,
                study_year  TEXT    NOT NULL,
                bio         TEXT    DEFAULT '',
                interests   TEXT    DEFAULT '[]',
                created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        """)

        # 3. Campus Connect: Student availability broadcasts
        conn.execute("""
            CREATE TABLE IF NOT EXISTS student_availabilities (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id       INTEGER NOT NULL,
                activity         TEXT    NOT NULL CHECK(activity IN ('STUDY', 'COFFEE', 'LUNCH', 'WALK', 'CASUAL_CHAT')),
                duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (15, 30, 60)),
                location_area    TEXT    DEFAULT 'Anywhere on Campus',
                note             TEXT    DEFAULT '',
                available_from   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
                expires_at       TEXT    NOT NULL,
                status           TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')),
                created_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE
            )
        """)

        # 4. Campus Connect Step 2: Connection requests
        conn.execute("""
            CREATE TABLE IF NOT EXISTS connection_requests (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id    INTEGER NOT NULL,
                receiver_id  INTEGER NOT NULL,
                status       TEXT    NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
                message      TEXT    DEFAULT '',
                created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(sender_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
                FOREIGN KEY(receiver_id) REFERENCES student_profiles(id) ON DELETE CASCADE
            )
        """)

        conn.commit()
