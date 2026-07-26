"""Resume / cover-letter customization — mock placeholder.

Real implementation would call Claude to rewrite the resume summary and
generate a tailored cover letter per job.
"""

from __future__ import annotations

from job_search_agent.state import JobListing


def customize_resume(
    job: JobListing,
    resume_text: str,
) -> dict[str, str]:
    """Return a dict with ``resume_snippet`` and ``cover_letter``.

    This is a **mock** that echoes back placeholder text.
    The real version lives in ``brain.py`` (Claude tool_use call).
    """
    return {
        "resume_snippet": (
            f"// Tailored summary for {job.title} at {job.company}\n"
            f"// Original resume would be rewritten here by Claude."
        ),
        "cover_letter": (
            f"Dear Hiring Manager,\n\n"
            f"I am excited to apply for the {job.title} role at {job.company}. "
            f"With my background in software engineering, I believe I would be "
            f"a strong fit for your team.\n\n"
            f"Sincerely,\nApplicant"
        ),
    }
