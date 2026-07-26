"""Vercel Python Serverless Function — Tavily search proxy.

Frontend calls POST /api/search with JSON body. Accepts an optional
``tavilyApiKey`` in the body so users can configure their own key
via the frontend Settings panel. Falls back to the server-side
TAVILY_API_KEY environment variable.
"""

import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self._cors_headers()
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw)
        except Exception:
            self._respond({"error": "Invalid JSON body"}, 400)
            return

        query = (body.get("query") or "").strip()
        location = (body.get("location") or "").strip()
        remote_only = bool(body.get("remoteOnly"))
        max_results = int(body.get("maxResults", 10))

        # API key: prefer user-provided from frontend settings, fallback to env
        tavily_key = (body.get("tavilyApiKey") or "").strip() or os.environ.get("TAVILY_API_KEY")

        if not query:
            self._respond({"error": "query is required"}, 400)
            return
        if not tavily_key:
            self._respond({"error": "TAVILY_API_KEY not configured — set it in Settings or Vercel env"}, 500)
            return

        search_q = query
        if remote_only:
            search_q += " remote"
        if location:
            search_q += f" {location}"

        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=tavily_key)
            response = client.search(
                query=search_q,
                max_results=max_results,
                search_depth="advanced",
                include_raw_content=False,
            )
        except Exception as exc:
            self._respond({"error": f"Tavily search failed: {exc}"}, 502)
            return

        jobs = []
        for hit in response.get("results", []):
            title = hit.get("title", "")
            url = hit.get("url", "")
            company = _extract_company(title, url)
            jobs.append({
                "id": url or title,
                "title": title,
                "company": company,
                "location": "",
                "salary": "",
                "url": url,
                "post_date": "",
                "snippet": (hit.get("content") or "")[:500],
                "match_score": 0,
                "missing_skills": [],
            })

        self._respond({"jobs": jobs})

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------
    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _respond(self, data, status=200):
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))


def _extract_company(title: str, url: str) -> str:
    for sep in [" at ", " @ ", " - ", " | ", " — "]:
        if sep in title:
            parts = title.split(sep)
            for p in parts:
                p = p.strip()
                if p and not p[0].isdigit() and len(p.split()) <= 5:
                    return p
    if url:
        domain = urlparse(url).netloc.lower()
        for prefix in ["www.", "careers.", "jobs.", "hiring."]:
            if domain.startswith(prefix):
                domain = domain[len(prefix):]
        company = domain.split(".")[0]
        if company:
            return company.capitalize()
    return "Unknown"
