"""LangGraph state machine — ReAct-based Job Search Agent.

Graph layout::

    START → init → search → evaluate → customize → confirm → record → END
                       ↑                                   │
                       └────── (low match: skip & loop) ───┘

The "brain" node runs the full ReAct loop internally (Claude tool_use).
This graph provides the outer orchestration phases and handles the
human-in-the-loop confirmation step.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Literal

from langgraph.graph import END, StateGraph

from job_search_agent.state import AgentState
from job_search_agent.brain import run_brain, MAX_DAILY_SUBMITS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def node_init(state: AgentState) -> AgentState:
    """Phase 0: Load resume, print startup banner."""
    state.phase = "init"
    state.iteration = 0
    logger.info("Phase: init — resume loaded=%s", bool(state.resume_text))
    return state


def node_search(state: AgentState) -> AgentState:
    """Phase 1: Hand off to the ReAct brain for the full pipeline.

    The brain internally drives search → evaluate → customize → confirm
    using Claude's tool_use loop.  This node simply runs it.
    """
    state.phase = "search"
    state = run_brain(state, max_iterations=state.max_iterations)
    return state


def node_confirm(state: AgentState) -> AgentState:
    """Phase 4: Human-in-the-loop gate.

    If the brain has set ``awaiting_user_input = True``, we pause here
    and wait for the user to reply with CONFIRM_APPLY_<job_id>.
    """
    state.phase = "confirm"

    if state.user_confirmation_pending:
        logger.info("Waiting for user confirmation: %s", state.pending_confirmation_token)
        state.awaiting_user_input = True
    else:
        # No pending confirmation — nothing to wait for
        state.awaiting_user_input = False

    return state


def node_record(state: AgentState) -> AgentState:
    """Phase 5: Final recording and cleanup."""
    state.phase = "record"
    logger.info(
        "Pipeline complete. Jobs found=%d, scored=%d, letters=%d, submitted=%d",
        len(state.raw_jobs),
        len(state.score_cache),
        len(state.cover_letters),
        state.today_submit_count,
    )
    return state


def node_done(state: AgentState) -> AgentState:
    """Terminal node."""
    state.phase = "done"
    state.done = True
    return state


def node_error(state: AgentState) -> AgentState:
    """Error terminal — prints progress snapshot."""
    state.phase = "error"
    state.done = True
    logger.error("Pipeline error: %s", state.error)
    return state


# ---------------------------------------------------------------------------
# Conditional edges
# ---------------------------------------------------------------------------

def after_search(state: AgentState) -> str:
    """Route after the brain runs: did it finish or hit an error?"""
    if state.error:
        return "error"
    if state.done:
        return "record"
    # Brain set awaiting_user_input — go to confirm gate
    if state.awaiting_user_input:
        return "confirm"
    return "record"


def after_confirm(state: AgentState) -> str:
    """Route after the confirmation gate."""
    if state.error:
        return "error"
    return "done"


# ---------------------------------------------------------------------------
# Build graph
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    """Construct the LangGraph StateGraph for the ReAct job search agent.

    ::

        START → init → search ──┬──→ confirm → done → END
                                │              ↑
                                └──→ record ───┘
                                │
                                └──→ error → done → END
    """
    graph = StateGraph(AgentState)

    # Nodes
    graph.add_node("init", node_init)
    graph.add_node("search", node_search)
    graph.add_node("confirm", node_confirm)
    graph.add_node("record", node_record)
    graph.add_node("done", node_done)
    graph.add_node("error", node_error)

    # Edges
    graph.set_entry_point("init")
    graph.add_edge("init", "search")

    graph.add_conditional_edges(
        "search",
        after_search,
        {
            "confirm": "confirm",
            "record": "record",
            "error": "error",
        },
    )

    graph.add_conditional_edges(
        "confirm",
        after_confirm,
        {
            "done": "done",
            "error": "error",
        },
    )

    graph.add_edge("record", "done")
    graph.add_edge("done", END)
    graph.add_edge("error", "done")

    return graph


# Compile once for import
compiled_graph = build_graph().compile()
