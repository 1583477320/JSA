"""Tool 2: parse_resume — Extract and structure text from resume files.

Supports PDF (via PyPDF2) and DOCX (via python-docx) formats.
Splits the extracted text into skills, experience, and education sections.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Section detection keywords
# ---------------------------------------------------------------------------

_SECTION_PATTERNS: dict[str, list[re.Pattern]] = {
    "skills": [
        re.compile(r"^(?:technical\s+)?skills?$", re.I),
        re.compile(r"^technologies$", re.I),
        re.compile(r"^competencies$", re.I),
        re.compile(r"^core\s+competencies$", re.I),
    ],
    "experience": [
        re.compile(r"^(?:work\s+)?experience$", re.I),
        re.compile(r"^professional\s+experience$", re.I),
        re.compile(r"^employment\s+history$", re.I),
        re.compile(r"^career\s+history$", re.I),
    ],
    "education": [
        re.compile(r"^education$", re.I),
        re.compile(r"^academic\s+background$", re.I),
        re.compile(r"^qualifications$", re.I),
    ],
}


def parse_resume(file_path: str) -> dict[str, Any]:
    """Extract text from a resume file and split into structured sections.

    Args:
        file_path: Path to a PDF or DOCX file.

    Returns:
        A dict with:
            - raw_text: Full extracted text
            - skills: List of skill strings
            - experience: List of experience entries (strings)
            - education: List of education entries (strings)
            - file_type: "pdf" or "docx"

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file extension is not supported.
        RuntimeError: If extraction fails.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Resume file not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix not in (".pdf", ".docx"):
        raise ValueError(
            f"Unsupported file format: {suffix}. Only .pdf and .docx are supported."
        )

    logger.info("Parsing resume: %s (format: %s)", file_path, suffix)

    # Extract raw text
    if suffix == ".pdf":
        raw_text = _extract_pdf(path)
    else:
        raw_text = _extract_docx(path)

    if not raw_text.strip():
        raise RuntimeError(f"Failed to extract text from {file_path} — file may be empty or image-based")

    logger.info("Extracted %d characters of text", len(raw_text))

    # Split into sections
    sections = _split_sections(raw_text)

    return {
        "raw_text": raw_text,
        "skills": sections.get("skills", []),
        "experience": sections.get("experience", []),
        "education": sections.get("education", []),
        "file_type": suffix.lstrip("."),
    }


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

def _extract_pdf(path: Path) -> str:
    """Extract text from a PDF using PyPDF2."""
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        raise RuntimeError("PyPDF2 is not installed. Run: pip install PyPDF2")

    try:
        reader = PdfReader(str(path))
        pages: list[str] = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages.append(text)
            else:
                logger.warning("Page %d returned empty text (may be image-based)", i)
        return "\n\n".join(pages)
    except Exception as exc:
        raise RuntimeError(f"PDF extraction failed: {exc}") from exc


# ---------------------------------------------------------------------------
# DOCX extraction
# ---------------------------------------------------------------------------

def _extract_docx(path: Path) -> str:
    """Extract text from a DOCX using python-docx."""
    try:
        from docx import Document
    except ImportError:
        raise RuntimeError("python-docx is not installed. Run: pip install python-docx")

    try:
        doc = Document(str(path))
        paragraphs: list[str] = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)
        return "\n\n".join(paragraphs)
    except Exception as exc:
        raise RuntimeError(f"DOCX extraction failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Section splitting
# ---------------------------------------------------------------------------

def _split_sections(raw_text: str) -> dict[str, list[str]]:
    """Split resume text into skills / experience / education sections.

    Strategy:
      1. Find section headers by matching known patterns.
      2. Assign lines between headers to the preceding section.
      3. Return each section as a list of non-empty lines.
    """
    lines = raw_text.splitlines()

    # Build a list of (line_index, section_name) for detected headers
    headers: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        stripped = line.strip().rstrip(":")
        for section_name, patterns in _SECTION_PATTERNS.items():
            if any(p.match(stripped) for p in patterns):
                headers.append((i, section_name))
                break

    if not headers:
        # No sections detected — try a keyword fallback
        return _fallback_split(raw_text)

    # Assign content between headers
    sections: dict[str, list[str]] = {name: [] for name in _SECTION_PATTERNS}
    headers.sort(key=lambda h: h[0])

    for idx, (line_no, section_name) in enumerate(headers):
        # End of this section is the start of the next (or end of file)
        end = headers[idx + 1][0] if idx + 1 < len(headers) else len(lines)
        content = [l.strip() for l in lines[line_no + 1 : end] if l.strip()]
        sections[section_name] = content

    return sections


def _fallback_split(raw_text: str) -> dict[str, list[str]]:
    """When no headers are found, use keyword heuristics."""
    skills: list[str] = []
    experience: list[str] = []
    education: list[str] = []

    skill_keywords = {"python", "java", "sql", "docker", "kubernetes", "aws", "git", "linux"}
    edu_keywords = {"university", "college", "bachelor", "master", "phd", "degree", "gpa", "b.s.", "m.s."}

    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        lower = line.lower()
        if any(kw in lower for kw in edu_keywords):
            education.append(line)
        elif any(kw in lower for kw in skill_keywords):
            skills.append(line)
        else:
            experience.append(line)

    return {"skills": skills, "experience": experience, "education": education}
