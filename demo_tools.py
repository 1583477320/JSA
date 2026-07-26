#!/usr/bin/env python3
"""Demo script — exercises all 5 tool functions end-to-end.

Usage:
    # Full pipeline demo (needs all API keys)
    python demo_tools.py

    # Test individual tools
    python demo_tools.py search "Python engineer"
    python demo_tools.py resume ./my_resume.pdf
    python demo_tools.py jd https://example.com/job/123
    python demo_tools.py score ./my_resume.pdf https://example.com/job/123
    python demo_tools.py db
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from job_search_agent.tools import (
    search_jobs,
    parse_resume,
    fetch_jd_text,
    calculate_match_score,
    save_to_db,
    query_applications,
    get_db_stats,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


def demo_search(query: str) -> None:
    """Demo: search for jobs."""
    print(f"\n{'='*60}")
    print(f"  🔍 SEARCH: {query}")
    print(f"{'='*60}")
    results = search_jobs(query, max_results=5)
    for i, job in enumerate(results):
        print(f"\n  [{i}] {job['title']}")
        print(f"      Company: {job['company']}")
        print(f"      URL:     {job['url']}")
        print(f"      Score:   {job['score']:.3f}")
        print(f"      Snippet: {job['snippet'][:120]}...")
    print(f"\n  Total: {len(results)} results\n")


def demo_parse_resume(file_path: str) -> dict:
    """Demo: parse a resume file."""
    print(f"\n{'='*60}")
    print(f"  📄 PARSE RESUME: {file_path}")
    print(f"{'='*60}")
    result = parse_resume(file_path)
    print(f"  File type:  {result['file_type']}")
    print(f"  Raw text:   {len(result['raw_text'])} chars")
    print(f"  Skills:     {len(result['skills'])} entries")
    print(f"  Experience: {len(result['experience'])} entries")
    print(f"  Education:  {len(result['education'])} entries")

    if result["skills"]:
        print(f"\n  Sample skills:")
        for s in result["skills"][:5]:
            print(f"    - {s[:80]}")

    return result


def demo_fetch_jd(url: str) -> str:
    """Demo: fetch job description text."""
    print(f"\n{'='*60}")
    print(f"  🌐 FETCH JD: {url}")
    print(f"{'='*60}")
    text = fetch_jd_text(url)
    print(f"  Length: {len(text)} chars")
    print(f"\n  Preview (first 500 chars):")
    print(f"  {text[:500]}")
    print()
    return text


def demo_score(resume_dict: dict, jd_text: str) -> dict:
    """Demo: calculate match score."""
    print(f"\n{'='*60}")
    print(f"  📊 MATCH SCORE")
    print(f"{'='*60}")
    result = calculate_match_score(resume_dict, jd_text)
    print(f"  Score:           {result['score']}/100")
    print(f"  Matching skills: {result['matching_skills']}")
    print(f"  Missing skills:  {result['missing_skills']}")
    print(f"  Summary:         {result['summary']}")
    print()
    return result


def demo_db() -> None:
    """Demo: save and query the database."""
    print(f"\n{'='*60}")
    print(f"  💾 DATABASE DEMO")
    print(f"{'='*60}")

    # Save a test record
    record = save_to_db(
        job_id="demo-job-001",
        status="applied",
        notes="Demo application",
        company="Demo Corp",
        title="Demo Engineer",
        url="https://example.com/demo",
        match_score=85,
    )
    print(f"  Saved: {record}")

    # Query
    apps = query_applications(limit=5)
    print(f"\n  Recent applications ({len(apps)}):")
    for app in apps:
        print(f"    [{app['status']}] {app['company']} - {app['title']}")

    # Stats
    stats = get_db_stats()
    print(f"\n  Stats: {stats}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Demo the tool functions")
    parser.add_argument(
        "command",
        nargs="?",
        choices=["search", "resume", "jd", "score", "db", "full"],
        default="full",
        help="Which tool to demo (default: full pipeline)",
    )
    parser.add_argument("args", nargs="*", help="Arguments for the command")
    args = parser.parse_args()

    if args.command == "search":
        query = args.args[0] if args.args else "Python engineer"
        demo_search(query)

    elif args.command == "resume":
        path = args.args[0] if args.args else "./sample_resume.pdf"
        demo_parse_resume(path)

    elif args.command == "jd":
        url = args.args[0] if args.args else "https://example.com/job/123"
        demo_fetch_jd(url)

    elif args.command == "score":
        print("Usage: python demo_tools.py score <resume_path> <jd_url>")

    elif args.command == "db":
        demo_db()

    elif args.command == "full":
        print("\n🚀 Running full demo pipeline...\n")

        # Step 1: Search
        demo_search("Python engineer")

        # Step 2: Fetch a sample JD (using a mock URL for demo)
        # In real usage, you'd use a real job posting URL
        print("\n  ℹ️  Skipping JD fetch (no real URL provided)")
        print("  ℹ️  Skipping resume parse (no file provided)")
        print("  ℹ️  Skipping scoring (needs resume + JD)")

        # Step 3: Database demo
        demo_db()

        print("\n✅ Demo complete!\n")


if __name__ == "__main__":
    main()
