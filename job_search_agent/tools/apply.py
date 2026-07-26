"""Application submission — mock now, Playwright ready.

When ``AUTO_APPLY`` is enabled, this module would drive a headless browser
to fill out application forms via Playwright.
"""

from __future__ import annotations

import os
from typing import Any

from job_search_agent.state import JobListing


def submit_application(
    job: JobListing,
    cover_letter: str,
    resume_snippet: str,
) -> dict[str, Any]:
    """Submit a job application.

    Returns a result dict with ``success`` and ``status`` keys.

    Currently **always succeeds** (mock).  The Playwright integration
    would:
      1. Launch a chromium page
      2. Navigate to ``job.url``
      3. Fill form fields
      4. Upload resume
      5. Submit
    """
    auto_apply = os.getenv("AUTO_APPLY", "false").lower() == "true"

    if not auto_apply:
        return {
            "success": True,
            "status": "simulated",
            "message": (
                f"[DRY RUN] Would submit application for "
                f"{job.title} at {job.company}"
            ),
        }

    # --- Playwright integration (uncomment when ready) ---
    # from playwright.sync_api import sync_playwright
    # with sync_playwright() as p:
    #     browser = p.chromium.launch(headless=True)
    #     page = browser.new_page()
    #     page.goto(job.url)
    #     # ... fill form, upload resume, click submit ...
    #     browser.close()

    return {
        "success": True,
        "status": "submitted",
        "message": f"Application submitted for {job.title} at {job.company}",
    }
