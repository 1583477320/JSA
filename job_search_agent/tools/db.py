"""Tool 5: save_to_db — SQLite persistence for job application tracking.

Creates and manages a local SQLite database to record job application
status, timestamps, and notes.
"""

from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_CREATE_TABLE = """\
CREATE TABLE IF NOT EXISTS applications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      TEXT    NOT NULL,
    company     TEXT    DEFAULT '',
    title       TEXT    DEFAULT '',
    url         TEXT    DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'pending',
    match_score INTEGER DEFAULT 0,
    notes       TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
"""


# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------

def _get_connection() -> sqlite3.Connection:
    """Open (or create) the SQLite database and ensure the schema exists."""
    db_path = os.getenv("JOB_DB_PATH", "./data/jobs.db")
    db_file = Path(db_path)

    # Ensure parent directory exists
    db_file.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_CREATE_TABLE)
    return conn


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_to_db(
    job_id: str,
    status: str = "pending",
    notes: str = "",
    company: str = "",
    title: str = "",
    url: str = "",
    match_score: int = 0,
) -> dict[str, Any]:
    """Record or update a job application in SQLite.

    If an application with the given ``job_id`` already exists, it is
    **updated** (status, notes, updated_at).  Otherwise a new row is
    inserted.

    Args:
        job_id: Unique identifier for the job (URL, internal ID, etc.).
        status: Application status — one of:
            "pending", "applied", "interviewing", "rejected", "accepted", "withdrawn"
        notes: Free-text notes about this application.
        company: Company name (stored for convenience).
        title: Job title (stored for convenience).
        url: Job posting URL.
        match_score: Match score 0-100 from calculate_match_score().

    Returns:
        A dict with the saved record's key fields:
            - id: Row ID
            - job_id: The job identifier
            - status: Current status
            - created_at: ISO timestamp
            - updated_at: ISO timestamp

    Raises:
        ValueError: If job_id is empty.
        RuntimeError: If the database operation fails.
    """
    if not job_id or not job_id.strip():
        raise ValueError("job_id must not be empty")

    valid_statuses = {"pending", "applied", "interviewing", "rejected", "accepted", "withdrawn"}
    if status not in valid_statuses:
        logger.warning("Invalid status %r — falling back to 'pending'", status)
        status = "pending"

    now = datetime.now(timezone.utc).isoformat()

    logger.info("Saving to DB: job_id=%s, status=%s", job_id, status)

    try:
        conn = _get_connection()
        cursor = conn.cursor()

        # Check if record exists
        existing = cursor.execute(
            "SELECT id FROM applications WHERE job_id = ?", (job_id,)
        ).fetchone()

        if existing:
            # Update existing record
            cursor.execute(
                """\
                UPDATE applications
                SET status = ?, notes = ?, updated_at = ?
                WHERE job_id = ?""",
                (status, notes, now, job_id),
            )
            row_id = existing["id"]
            logger.info("Updated existing record id=%d", row_id)
        else:
            # Insert new record
            cursor.execute(
                """\
                INSERT INTO applications
                    (job_id, company, title, url, status, match_score, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (job_id, company, title, url, status, match_score, notes, now, now),
            )
            row_id = cursor.lastrowid
            logger.info("Inserted new record id=%d", row_id)

        conn.commit()
        conn.close()

        return {
            "id": row_id,
            "job_id": job_id,
            "status": status,
            "created_at": now,
            "updated_at": now,
        }

    except sqlite3.Error as exc:
        logger.error("SQLite error: %s", exc)
        raise RuntimeError(f"Database operation failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Query helpers (bonus — useful for reporting)
# ---------------------------------------------------------------------------

def query_applications(
    status: Optional[str] = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Query recorded applications, optionally filtered by status.

    Args:
        status: If provided, filter by this status.
        limit: Maximum rows to return (default 50).

    Returns:
        List of application record dicts.
    """
    conn = _get_connection()
    cursor = conn.cursor()

    if status:
        rows = cursor.execute(
            "SELECT * FROM applications WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
            (status, limit),
        ).fetchall()
    else:
        rows = cursor.execute(
            "SELECT * FROM applications ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()

    conn.close()
    return [dict(row) for row in rows]


def get_db_stats() -> dict[str, Any]:
    """Return summary statistics from the applications database."""
    conn = _get_connection()
    cursor = conn.cursor()

    total = cursor.execute("SELECT COUNT(*) as cnt FROM applications").fetchone()["cnt"]
    by_status = cursor.execute(
        "SELECT status, COUNT(*) as cnt FROM applications GROUP BY status"
    ).fetchall()

    conn.close()
    return {
        "total": total,
        "by_status": {row["status"]: row["cnt"] for row in by_status},
    }
