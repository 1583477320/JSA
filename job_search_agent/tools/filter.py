"""Job filtering tool — score & rank jobs against user preferences."""

from __future__ import annotations

from job_search_agent.state import JobListing


def filter_jobs(
    jobs: list[JobListing],
    preferences: dict | None = None,
    min_score: float = 0.5,
) -> list[JobListing]:
    """Return jobs whose match_score >= *min_score*, sorted descending.

    In the current mock pipeline the brain assigns scores via Claude;
    this function just filters and sorts.  A future version could add
    keyword‑based heuristics here as a fast pre‑filter.
    """
    prefs = preferences or {}

    # Keyword boost — simple token overlap with preference keywords
    keywords = [k.lower() for k in prefs.get("keywords", [])]

    for job in jobs:
        text = f"{job.title} {job.description}".lower()
        if keywords:
            overlap = sum(1 for kw in keywords if kw in text)
            job.match_score = min(1.0, overlap / max(len(keywords), 1))

    filtered = [j for j in jobs if j.match_score >= min_score]
    filtered.sort(key=lambda j: j.match_score, reverse=True)
    return filtered
