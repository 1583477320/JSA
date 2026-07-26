"""Tool functions for the Job Search Agent.

Real implementations:
  - search_jobs:              Tavily Search API
  - parse_resume:             PyPDF2 / python-docx
  - fetch_jd_text:            requests + BeautifulSoup
  - calculate_match_score:    OpenAI-compatible LLM
  - craft_cover_letter:       OpenAI-compatible LLM
  - update_application_tracker: SQLite
  - save_to_db:               SQLite (legacy alias)
"""

from job_search_agent.tools.search import search_jobs
from job_search_agent.tools.parse_resume import parse_resume
from job_search_agent.tools.fetch_jd import fetch_jd_text
from job_search_agent.tools.score import calculate_match_score
from job_search_agent.tools.cover_letter import craft_cover_letter
from job_search_agent.tools.tracker import (
    update_application_tracker,
    query_tracker,
    get_submit_count_today,
)
from job_search_agent.tools.db import save_to_db, query_applications, get_db_stats

__all__ = [
    # Core tools (mapped to Claude tool_use)
    "search_jobs",
    "parse_resume",
    "fetch_jd_text",
    "calculate_match_score",
    "craft_cover_letter",
    "update_application_tracker",
    # Utilities
    "query_tracker",
    "get_submit_count_today",
    "save_to_db",
    "query_applications",
    "get_db_stats",
]
