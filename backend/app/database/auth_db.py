"""
AtmoGraph - Authentication Database Layer
SQLite-based user persistence and management.
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

ROOT_DIR = Path(__file__).resolve().parents[3]
DB_PATH = ROOT_DIR / "data" / "users.db"


def get_db_connection() -> sqlite3.Connection:
    """Get a SQLite database connection with row factory enabled."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    """Initialize the SQLite users table and seed a default enterprise demo account."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    organization TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_login TEXT,
                    is_active INTEGER DEFAULT 1
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"
            )
    finally:
        conn.close()


def create_user(
    full_name: str,
    email: str,
    password_hash: str,
    organization: Optional[str] = None,
) -> Dict[str, Any]:
    """Create and persist a new user in the SQLite database."""
    clean_email = email.strip().lower()
    user_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO users (
                    id, full_name, email, password_hash, organization,
                    created_at, updated_at, last_login, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    user_id,
                    full_name.strip(),
                    clean_email,
                    password_hash,
                    organization.strip() if organization else "Enterprise Operations",
                    now_iso,
                    now_iso,
                    now_iso,
                ),
            )
        return {
            "id": user_id,
            "full_name": full_name.strip(),
            "email": clean_email,
            "organization": organization.strip() if organization else "Enterprise Operations",
            "created_at": now_iso,
            "is_active": True,
        }
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve a user by their case-insensitive email address."""
    clean_email = email.strip().lower()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, full_name, email, password_hash, organization,
                   created_at, updated_at, last_login, is_active
            FROM users
            WHERE lower(email) = ?
            LIMIT 1
            """,
            (clean_email,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a user by their unique UUID string."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, full_name, email, password_hash, organization,
                   created_at, updated_at, last_login, is_active
            FROM users
            WHERE id = ?
            LIMIT 1
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def update_last_login(user_id: str) -> None:
    """Update the last_login timestamp for a user upon successful authentication."""
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                UPDATE users
                SET last_login = ?, updated_at = ?
                WHERE id = ?
                """,
                (now_iso, now_iso, user_id),
            )
    finally:
        conn.close()
