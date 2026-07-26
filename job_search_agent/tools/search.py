"""Tool 1: search_jobs — Tavily Search API integration.

Searches for job postings using the Tavily Search API and returns
structured results.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def search_jobs(
    query: str,
    location: str = "",
    remote_only: bool = False,
    max_results: int = 10,
) -> list[dict[str, Any]]:
    """Search for job postings via the Tavily Search API.

    Args:
        query: Job search query (e.g. "Python engineer").
        location: Optional location filter (e.g. "San Francisco").
        remote_only: If True, append "remote" to the query.
        max_results: Maximum number of results to return (default 10).

    Returns:
        A list of dicts, each containing:
            - title: Job title
            - company: Company name (extracted from title or URL)
            - url: Direct link to the job posting
            - snippet: Short description from the search result
            - score: Relevance score from Tavily (0-1)
            - raw_content: Full content if available

    Raises:
        ValueError: If TAVILY_API_KEY is not set.
        RuntimeError: If the Tavily API call fails.
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError(
            "TAVILY_API_KEY environment variable is not set. "
            "Get a free key at https://tavily.com"
        )

    # Build the search query
    search_query = query
    if remote_only:
        search_query += " remote"
    if location:
        search_query += f" {location}"

    search_query += " job posting hiring"

    logger.info("Searching Tavily: query=%r, max_results=%d", search_query, max_results)

    try:
        from tavily import TavilyClient
    except ImportError:
        raise RuntimeError(
            "tavily-python is not installed. Run: pip install tavily-python"
        )

    try:
        client = TavilyClient(api_key=api_key)
        response = client.search(
            query=search_query,
            max_results=max_results,
            search_depth="advanced",
            include_raw_content=False,
        )
    except Exception as exc:
        logger.error("Tavily API call failed: %s", exc)
        raise RuntimeError(f"Tavily search failed: {exc}") from exc

    results: list[dict[str, Any]] = []
    for hit in response.get("results", []):
        title = hit.get("title", "Unknown Title")
        url = hit.get("url", "")

        # Try to extract company name from title (common pattern: "Role at Company")
        company = _extract_company(title, url)

        results.append({
            "title": title,
            "company": company,
            "url": url,
            "snippet": hit.get("content", "")[:500],
            "score": hit.get("score", 0.0),
            "raw_content": hit.get("raw_content"),
        })

    logger.info("Found %d job results", len(results))
    return results


def _extract_company(title: str, url: str) -> str:
    """Best-effort extraction of company name from a search result title."""
    # Common patterns: "Software Engineer at Google", "Google - Software Engineer"
    for sep in [" at ", " @ ", " - ", " | ", " — "]:
        if sep in title:
            parts = title.split(sep)
            # Return whichever side looks like a company name
            for part in parts:
                part = part.strip()
                # Company names are typically shorter and capitalized
                if part and not part[0].isdigit() and len(part.split()) <= 5:
                    return part

    # Fallback: extract from URL domain
    if url:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        # Remove www. and common TLDs
        for prefix in ["www.", "careers.", "jobs.", "hiring."]:
            if domain.startswith(prefix):
                domain = domain[len(prefix):]
        company = domain.split(".")[0]
        if company:
            return company.capitalize()

    return "Unknown"
