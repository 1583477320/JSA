"""Record-keeping tool — append application results to a JSON log."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "data"
LOG_FILE = LOG_DIR / "applications.jsonl"


def record_application(
    job: dict[str, Any],
    cover_letter: str,
    status: str = "submitted",
    notes: str = "",
) -> dict[str, Any]:
    """Append one application record to the JSONL log.

    Returns the record that was written.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "job": job,
        "cover_letter": cover_letter,
        "status": status,
        "notes": notes,
    }

    with open(LOG_FILE, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    return record
