"""LangGraph state definition — ReAct-based Job Search Agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


# ---------------------------------------------------------------------------
# Graph state — single source of truth flowing through the ReAct loop
# ---------------------------------------------------------------------------

@dataclass
class AgentState:
    """Mutable state that LangGraph serialises between steps.

    Every ReAct iteration reads and mutates this object.  Keep all fields
    JSON-safe so LangGraph can snapshot / resume correctly.
    """

    # === User inputs (set once at init) ===
    search_query: str = ""
    location: str = ""
    remote_only: bool = False
    resume_text: str = ""
    resume_dict: dict[str, Any] = field(default_factory=dict)
    preferences: dict[str, Any] = field(default_factory=dict)

    # === ReAct control flow ===
    phase: Literal[
        "init", "search", "evaluate", "customize",
        "confirm", "apply", "record", "done", "error",
    ] = "init"
    iteration: int = 0
    max_iterations: int = 10
    error: str = ""
    done: bool = False

    # === Conversation memory (Claude sees these in context) ===
    messages: list[dict[str, Any]] = field(default_factory=list)
    thoughts: list[str] = field(default_factory=list)
    observations: list[str] = field(default_factory=list)

    # === Pipeline data ===
    raw_jobs: list[dict[str, Any]] = field(default_factory=list)
    filtered_jobs: list[dict[str, Any]] = field(default_factory=list)
    jd_cache: dict[str, str] = field(default_factory=dict)     # url -> jd_text
    score_cache: dict[str, dict[str, Any]] = field(default_factory=dict)  # job_id -> score result
    cover_letters: dict[str, str] = field(default_factory=dict)  # job_id -> cover letter text

    # === Current focus ===
    current_job_id: str = ""
    current_job: dict[str, Any] = field(default_factory=dict)

    # === Human-in-the-loop ===
    user_confirmation_pending: bool = False
    pending_confirmation_token: str = ""
    awaiting_user_input: bool = False
    user_message: str = ""

    # === Rate limiting & safety ===
    today_submit_count: int = 0
    last_request_time: float = 0.0
    domain_last_hit: dict[str, float] = field(default_factory=dict)

    # === Output ===
    final_report: str = ""
    applications_today: list[dict[str, Any]] = field(default_factory=list)
