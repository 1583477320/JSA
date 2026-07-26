"""Tool 3: fetch_jd_text — Extract job description text from a URL.

Uses requests + BeautifulSoup to fetch a job posting page and extract
the main content, stripping headers, footers, and navigation elements.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

# Tags and classes commonly used for non-content areas
_NOISE_TAGS = {"nav", "footer", "header", "aside", "script", "style", "noscript"}
_NOISE_CLASSES = re.compile(
    r"(cookie|consent|popup|modal|banner|sidebar|widget|social|share|"
    r"comment|disqus|newsletter|subscribe|signup|login|auth|nav|footer|header)",
    re.I,
)
_NOISE_ROLES = {"navigation", "banner", "contentinfo", "complementary"}

# Classes / IDs that commonly contain the job description
_CONTENT_SELECTORS = [
    # Generic job boards
    {"class_": re.compile(r"(job[-_]?description|jd|posting|description|content[-_]?body)", re.I)},
    {"id": re.compile(r"(job[-_]?description|jd|posting|description|content)", re.I)},
    # LinkedIn
    {"class_": "description__text"},
    {"class_": "show-more-less-html__markup"},
    # Indeed
    {"id": "jobDescriptionText"},
    # Greenhouse
    {"class_": "content"},
    # Lever
    {"class_": "posting-page"},
]

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def fetch_jd_text(
    url: str,
    timeout: int = 15,
    selectors: Optional[list[dict]] = None,
) -> str:
    """Fetch a job posting URL and extract the description as clean text.

    Args:
        url: Direct link to a job posting page.
        timeout: HTTP request timeout in seconds (default 15).
        selectors: Optional list of BeautifulSoup kwargs to locate the
            content container. Overrides the built-in selectors.

    Returns:
        The extracted job description text (may be empty if parsing fails).

    Raises:
        ValueError: If the URL is invalid or empty.
        RuntimeError: If the HTTP request or parsing fails.
    """
    if not url or not url.strip():
        raise ValueError("URL must not be empty")

    url = url.strip()
    parsed = urlparse(url)
    if not parsed.scheme:
        url = "https://" + url
        parsed = urlparse(url)

    if not parsed.netloc:
        raise ValueError(f"Invalid URL: {url}")

    logger.info("Fetching job description: %s", url)

    # --- HTTP request ---
    try:
        resp = requests.get(url, headers=_DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"HTTP request failed for {url}: {exc}") from exc

    content_type = resp.headers.get("content-type", "")
    if "text/html" not in content_type and "application/xhtml" not in content_type:
        raise RuntimeError(f"Response is not HTML (content-type: {content_type})")

    # --- Parse HTML ---
    try:
        soup = BeautifulSoup(resp.text, "lxml")
    except Exception:
        # Fallback to built-in parser
        soup = BeautifulSoup(resp.text, "html.parser")

    # Remove noise elements
    _strip_noise(soup)

    # Try to find the main content container
    text = _extract_content(soup, selectors)

    # Clean up
    text = _clean_text(text)

    logger.info("Extracted %d characters from %s", len(text), url)
    return text


# ---------------------------------------------------------------------------
# Noise removal
# ---------------------------------------------------------------------------

def _strip_noise(soup: BeautifulSoup) -> None:
    """Remove navigation, footer, scripts, and other non-content elements."""
    # Remove tags
    for tag_name in _NOISE_TAGS:
        for el in soup.find_all(tag_name):
            el.decompose()

    # Remove elements with noise classes
    for el in soup.find_all(True):
        classes = " ".join(el.get("class", []))
        el_id = el.get("id", "")
        role = el.get("role", "")

        if _NOISE_CLASSES.search(classes) or _NOISE_CLASSES.search(el_id):
            el.decompose()
        elif role in _NOISE_ROLES:
            el.decompose()


# ---------------------------------------------------------------------------
# Content extraction
# ---------------------------------------------------------------------------

def _extract_content(soup: BeautifulSoup, selectors: Optional[list[dict]] = None) -> str:
    """Try to find the main job description text."""
    active_selectors = selectors or _CONTENT_SELECTORS

    # Try each known selector
    for sel_kwargs in active_selectors:
        container = soup.find(**sel_kwargs)
        if container and len(container.get_text(strip=True)) > 50:
            return container.get_text(separator="\n", strip=True)

    # Fallback: try <article> or <main>
    for tag in ("article", "main", "section"):
        el = soup.find(tag)
        if el and len(el.get_text(strip=True)) > 100:
            return el.get_text(separator="\n", strip=True)

    # Last resort: use the largest <div> by text length
    divs = soup.find_all("div")
    if divs:
        best = max(divs, key=lambda d: len(d.get_text(strip=True)))
        text = best.get_text(separator="\n", strip=True)
        if len(text) > 100:
            return text

    # Absolute fallback: full body
    body = soup.find("body")
    if body:
        return body.get_text(separator="\n", strip=True)

    return soup.get_text(separator="\n", strip=True)


# ---------------------------------------------------------------------------
# Text cleanup
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """Remove excess whitespace and normalize the extracted text."""
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove lines that are just whitespace
    text = re.sub(r"[ \t]+\n", "\n", text)
    # Collapse multiple spaces within lines
    text = re.sub(r"([^\n]) {2,}", r"\1 ", text)
    return text.strip()
