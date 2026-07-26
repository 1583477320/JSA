"""Entry point for the Job Search Agent — interactive ReAct mode."""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

from job_search_agent.state import AgentState
from job_search_agent.graph import compiled_graph
from job_search_agent.brain import (
    MAX_DAILY_SUBMITS,
    _print_startup_banner,
    _print_progress_snapshot,
)
from job_search_agent.tools.tracker import get_submit_count_today


def _setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _detect_confirmation(text: str) -> str | None:
    """Check if user input contains a CONFIRM_APPLY_<job_id> token."""
    match = re.search(r"CONFIRM_APPLY_(\S+)", text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def _interactive_loop(initial_state: AgentState) -> AgentState:
    """Run the graph, then enter an interactive loop for human confirmation.

    After the brain pauses for confirmation, this loop waits for the user
    to type CONFIRM_APPLY_<job_id> or provide new instructions.
    """
    state = initial_state

    # First run
    result: dict[str, Any] = compiled_graph.invoke(state)
    state = result if isinstance(result, AgentState) else AgentState(**result)

    # If waiting for user input, enter interactive loop
    max_rounds = 5  # Max confirmation rounds
    for round_num in range(max_rounds):
        if not state.awaiting_user_input:
            break

        print("\n" + "═" * 60)
        print("  ⏸️  已暂停 — 等待您的确认")
        print("  请回复 CONFIRM_APPLY_<岗位ID> 以确认投递")
        print("  或输入新的指令继续")
        print("═" * 60)

        try:
            user_input = input("\n👤 您的回复: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\n👋 用户中断，退出。")
            state.phase = "done"
            state.done = True
            return state

        if not user_input:
            continue

        # Check for confirmation token
        confirm_token = _detect_confirmation(user_input)
        if confirm_token:
            job_id = confirm_token
            state.user_confirmation_pending = False
            state.awaiting_user_input = False
            state.user_message = user_input

            # Add confirmation to messages and re-run the brain
            state.messages.append({
                "role": "user",
                "content": (
                    f"用户已确认投递。请调用 submit_application 提交岗位 {job_id}，"
                    f"设置 user_confirmed=True。"
                ),
            })

            from job_search_agent.brain import run_brain
            state = run_brain(state, max_iterations=3)
            continue

        # Otherwise, treat as a new instruction
        state.messages.append({"role": "user", "content": user_input})
        state.awaiting_user_input = False
        state.user_confirmation_pending = False

        from job_search_agent.brain import run_brain
        state = run_brain(state, max_iterations=3)

    return state


def main() -> None:
    parser = argparse.ArgumentParser(
        description="🤖 Job Search Agent — ReAct autonomous job hunting with Claude"
    )
    parser.add_argument(
        "query",
        nargs="?",
        default="",
        help="Job search query (e.g. 'Python engineer remote')",
    )
    parser.add_argument(
        "--resume", "-r",
        type=str,
        default="",
        help="Path to resume file (.pdf or .docx)",
    )
    parser.add_argument(
        "--location", "-l",
        type=str,
        default="",
        help="Target city or region",
    )
    parser.add_argument(
        "--remote",
        action="store_true",
        help="Only search for remote positions",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=10,
        help="Maximum ReAct iterations (default: 10)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)",
    )
    args = parser.parse_args()

    _setup_logging(args.log_level)

    # Validate API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("❌ 错误: ANTHROPIC_API_KEY 未设置。")
        print("   请复制 .env.example → .env 并填入你的 API Key。")
        sys.exit(1)

    # If no query provided, enter interactive mode
    search_query = args.query
    if not search_query:
        _print_startup_banner(AgentState())
        print("  请告诉我您的求职意向（岗位关键词 + 城市）：")
        try:
            search_query = input("\n👤 搜索关键词: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 再见！")
            sys.exit(0)
        if not search_query:
            print("❌ 搜索关键词不能为空。")
            sys.exit(1)

    # Load resume if provided
    resume_dict: dict[str, Any] = {}
    resume_text = ""
    if args.resume:
        from job_search_agent.tools.parse_resume import parse_resume
        try:
            resume_dict = parse_resume(args.resume)
            resume_text = resume_dict.get("raw_text", "")
            print(f"📄 简历已加载: {len(resume_text)} 字符")
        except Exception as exc:
            print(f"⚠️ 简历加载失败: {exc}")
            print("   智能体将在运行时要求您提供简历。")

    # Build initial state
    state = AgentState(
        search_query=search_query,
        location=args.location,
        remote_only=args.remote,
        resume_text=resume_text,
        resume_dict=resume_dict,
        max_iterations=args.max_iterations,
    )

    # Run
    try:
        final_state = _interactive_loop(state)
    except KeyboardInterrupt:
        print("\n\n👋 用户中断，退出。")
        final_state = state

    # Print final summary
    _print_progress_snapshot(final_state)

    if final_state.final_report:
        print(f"\n{'─'*60}")
        print("  📝 最终报告:")
        print(f"{'─'*60}")
        print(final_state.final_report)


if __name__ == "__main__":
    main()
