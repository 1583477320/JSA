"""Tool 4: calculate_match_score — LLM-powered resume ↔ JD matching.

Calls an OpenAI-compatible API to score how well a resume matches a job
description, and identifies missing skills.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_SCORING_PROMPT = """\
You are an expert technical recruiter. Analyze how well the following resume \
matches the job description.

## Resume
{resume_text}

## Job Description
{jd_text}

Score the match from 0 to 100 based on:
- Skills overlap (40%)
- Experience relevance (30%)
- Education fit (15%)
- Location / remote alignment (15%)

Return ONLY a JSON object with this exact structure (no markdown fences):
{{
  "score": <int 0-100>,
  "missing_skills": [<list of skills the candidate lacks>],
  "matching_skills": [<list of skills the candidate has>],
  "summary": "<one-sentence assessment>"
}}
"""


def calculate_match_score(
    resume_dict: dict[str, Any],
    jd_text: str,
) -> dict[str, Any]:
    """Use an LLM to score how well a resume matches a job description.

    Args:
        resume_dict: Dict from parse_resume() with keys:
            raw_text, skills, experience, education.
        jd_text: Plain-text job description from fetch_jd_text().

    Returns:
        A dict with:
            - score: int (0-100)
            - missing_skills: list[str]
            - matching_skills: list[str]
            - summary: str

    Raises:
        ValueError: If required env vars are missing.
        RuntimeError: If the LLM API call fails or returns invalid JSON.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable is not set. "
            "Set it in .env or export it."
        )

    # Build resume text for the prompt
    resume_text = resume_dict.get("raw_text", "")
    if not resume_text:
        # Fallback: reconstruct from sections
        parts = []
        if resume_dict.get("skills"):
            parts.append("Skills:\n" + "\n".join(resume_dict["skills"]))
        if resume_dict.get("experience"):
            parts.append("Experience:\n" + "\n".join(resume_dict["experience"]))
        if resume_dict.get("education"):
            parts.append("Education:\n" + "\n".join(resume_dict["education"]))
        resume_text = "\n\n".join(parts) if parts else "(empty resume)"

    prompt = _SCORING_PROMPT.format(
        resume_text=resume_text[:4000],  # Truncate to avoid token limits
        jd_text=jd_text[:4000],
    )

    logger.info(
        "Calculating match score via %s (model=%s)", base_url, model
    )

    # --- Call OpenAI-compatible API ---
    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError("openai package is not installed. Run: pip install openai")

    try:
        client = OpenAI(api_key=api_key, base_url=base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise technical recruiter. "
                               "Always respond with valid JSON only, no markdown.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1024,
        )
    except Exception as exc:
        logger.error("LLM API call failed: %s", exc)
        raise RuntimeError(f"LLM scoring failed: {exc}") from exc

    # --- Parse response ---
    raw_content = response.choices[0].message.content or ""
    logger.debug("LLM raw response: %s", raw_content[:500])

    # Strip markdown fences if present
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (possibly with language tag)
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
        # Remove closing fence
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM response as JSON: %s", exc)
        raise RuntimeError(
            f"LLM returned invalid JSON. Raw response:\n{raw_content[:500]}"
        ) from exc

    # Validate and normalize
    score = int(result.get("score", 0))
    score = max(0, min(100, score))

    return {
        "score": score,
        "missing_skills": result.get("missing_skills", []),
        "matching_skills": result.get("matching_skills", []),
        "summary": result.get("summary", ""),
    }


# Re-export re for the fence-stripping regex
import re  # noqa: E402
