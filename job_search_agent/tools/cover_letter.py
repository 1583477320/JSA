"""craft_cover_letter — Generate a tailored cover letter via LLM.

Uses an OpenAI-compatible API to produce a 250-400 word cover letter
customised for the target company and role.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_COVER_LETTER_PROMPT = """\
You are an expert career coach and technical writer. Write a cover letter \
for the following job application.

## Candidate Resume
{resume_text}

## Job Description
{jd_text}

## Company: {company_name}
## Position: {job_title}
## Tone: {tone}

## Requirements
- Length: 250-400 words
- Structure: Opening → Technical Fit → Value Proposition → Closing
- Language: Match the JD language (English JD → English letter, Chinese JD → Chinese letter)
- If the resume has missing_skills relative to the JD, explicitly bridge them \
  in the second paragraph by linking transferable experience.
- Do NOT use generic filler. Be specific about technologies and projects.
- Do NOT include the candidate's real phone number or address.

Return ONLY the cover letter text, no markdown fences, no commentary.
"""


def craft_cover_letter(
    resume_dict: dict[str, Any],
    jd_text: str,
    company_name: str = "",
    job_title: str = "",
    tone: str = "professional",
) -> str:
    """Generate a tailored cover letter via an OpenAI-compatible LLM.

    Args:
        resume_dict: Parsed resume dict from ``parse_resume()``.
        jd_text: Job description text from ``fetch_jd_text()``.
        company_name: Target company name.
        job_title: Target job title.
        tone: Writing tone — "professional", "enthusiastic", "concise".

    Returns:
        The generated cover letter as a plain string (250-400 words).

    Raises:
        ValueError: If OPENAI_API_KEY is not set.
        RuntimeError: If the LLM call fails.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    # Build resume text
    resume_text = resume_dict.get("raw_text", "")
    if not resume_text:
        parts: list[str] = []
        if resume_dict.get("skills"):
            parts.append("Skills:\n" + "\n".join(resume_dict["skills"]))
        if resume_dict.get("experience"):
            parts.append("Experience:\n" + "\n".join(resume_dict["experience"]))
        if resume_dict.get("education"):
            parts.append("Education:\n" + "\n".join(resume_dict["education"]))
        resume_text = "\n\n".join(parts) or "(empty)"

    prompt = _COVER_LETTER_PROMPT.format(
        resume_text=resume_text[:4000],
        jd_text=jd_text[:4000],
        company_name=company_name or "Unknown",
        job_title=job_title or "Unknown",
        tone=tone,
    )

    logger.info("Generating cover letter for %s / %s", company_name, job_title)

    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError("openai package not installed. Run: pip install openai")

    try:
        client = OpenAI(api_key=api_key, base_url=base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a career coach. Return only the cover letter "
                        "text. No markdown fences. No commentary."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
    except Exception as exc:
        raise RuntimeError(f"LLM cover letter generation failed: {exc}") from exc

    text = (response.choices[0].message.content or "").strip()

    # Strip accidental markdown fences
    if text.startswith("```"):
        text = re.sub(r"^```(?:\w+)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)

    logger.info("Cover letter generated: %d chars", len(text))
    return text.strip()
