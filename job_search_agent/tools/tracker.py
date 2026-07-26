"""update_application_tracker — SQLite-based application status tracker.

Wraps the database layer with the status codes defined in the System Prompt.
"""

from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Status codes from the System Prompt (iron rules)
VALID_STATUSES = {
    "SEARCHING",
    "SHORTLISTED",
    "TAILORING",
    "AWAITING_CONFIRM",
    "APPLIED",
    "REJECTED",
    "FAILED",
}

_CREATE_TABLE = """\
CREATE TABLE IF NOT EXISTS applications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          TEXT    NOT NULL,
    company         TEXT    DEFAULT '',
    title           TEXT    DEFAULT '',
    url             TEXT    DEFAULT '',
    salary          TEXT    DEFAULT '',
    match_score     INTEGER DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'SEARCHING',
    cover_letter    TEXT    DEFAULT '',
    notes           TEXT    DEFAULT '',
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_job_id  ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_app_status  ON applications(status);
"""


def _get_conn() -> sqlite3.Connection:
    db_path = os.getenv("JOB_DB_PATH", "./data/jobs.db")
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_CREATE_TABLE)
    return conn


def update_application_tracker(
    job_id: str,
    status: str = "SEARCHING",
    company: str = "",
    title: str = "",
    url: str = "",
    salary: str = "",
    match_score: int = 0,
    cover_letter: str = "",
    notes: str = "",
) -> dict[str, Any]:
    """Record or update an application's status in SQLite.

    Args:
        job_id: Unique job identifier (URL or internal ID).
        status: One of SEARCHING, SHORTLISTED, TAILORING, AWAITING_CONFIRM,
                APPLIED, REJECTED, FAILED.
        company: Company name.
        title: Job title.
        url: Job posting URL.
        salary: Salary range string.
        match_score: Score 0-100.
        cover_letter: Generated cover letter text.
        notes: Free-text notes.

    Returns:
        Dict with ``id``, ``job_id``, ``status``, ``updated_at``.

    Raises:
        ValueError: If job_id empty or status invalid.
        RuntimeError: On database error.
    """
    if not job_id or not job_id.strip():
        raise ValueError("job_id must not be empty")

    if status not in VALID_STATUSES:
        logger.warning("Invalid status %r — defaulting to SEARCHING", status)
        status = "SEARCHING"

    now = datetime.now(timezone.utc).isoformat()
    logger.info("Tracker: job_id=%s status=%s", job_id, status)

    try:
        conn = _get_conn()
        cur = conn.cursor()

        existing = cur.execute(
            "SELECT id FROM applications WHERE job_id = ?", (job_id,)
        ).fetchone()

        if existing:
            # Build dynamic SET clause — only update non-empty fields
            updates: list[str] = ["status = ?", "updated_at = ?"]
            params: list[Any] = [status, now]

            if company:
                updates.append("company = ?")
                params.append(company)
            if title:
                updates.append("title = ?")
                params.append(title)
            if url:
                updates.append("url = ?")
                params.append(url)
            if salary:
                updates.append("salary = ?")
                params.append(salary)
            if match_score:
                updates.append("match_score = ?")
                params.append(match_score)
            if cover_letter:
                updates.append("cover_letter = ?")
                params.append(cover_letter)
            if notes:
                updates.append("notes = ?")
                params.append(notes)

            params.append(job_id)
            cur.execute(
                f"UPDATE applications SET {', '.join(updates)} WHERE job_id = ?",
                params,
            )
            row_id = existing["id"]
            logger.info("Updated record id=%d", row_id)
        else:
            cur.execute(
                """\
                INSERT INTO applications
                    (job_id, company, title, url, salary, match_score,
                     status, cover_letter, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (job_id, company, title, url, salary, match_score,
                 status, cover_letter, notes, now, now),
            )
            row_id = cur.lastrowid
            logger.info("Inserted record id=%d", row_id)

        conn.commit()
        conn.close()

        return {
            "id": row_id,
            "job_id": job_id,
            "status": status,
            "updated_at": now,
        }

    except sqlite3.Error as exc:
        raise RuntimeError(f"Database error: {exc}") from exc


def query_tracker(
    status: Optional[str] = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Query the tracker, optionally filtered by status."""
    conn = _get_conn()
    cur = conn.cursor()
    if status:
        rows = cur.execute(
            "SELECT * FROM applications WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
            (status, limit),
        ).fetchall()
    else:
        rows = cur.execute(
            "SELECT * FROM applications ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_submit_count_today() -> int:
    """Return how many applications were submitted today (UTC)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conn = _get_conn()
    cur = conn.cursor()
    row = cur.execute(
        "SELECT COUNT(*) as cnt FROM applications WHERE status = 'APPLIED' AND updated_at LIKE ?",
        (f"{today}%",),
    ).fetchone()
    conn.close()
    return row["cnt"] if row else 0
