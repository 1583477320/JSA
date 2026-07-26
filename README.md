# 🤖 Job Search Agent (JSA)

An autonomous job hunting agent built with **LangGraph** + **Claude API**. The agent searches for jobs, filters by relevance, tailors your resume, and tracks applications — all orchestrated as a state machine with Claude as the decision brain.

## Architecture

```
┌─────────┐     ┌───────┐     ┌──────────┐
│  START   │────▶│ search │────▶│  brain   │
└─────────┘     └───────┘     └────┬─────┘
                                    │
                         Claude tool_use loop
                         ┌──────────┼──────────┐
                         ▼          ▼          ▼
                    search_jobs  filter_jobs  customize_resume
                                        │          │
                                        ▼          ▼
                                   submit_application
                                        │
                                        ▼
                                   record_application
                                        │
                                        ▼
                              ┌──────────────┐
                              │   END (done)  │
                              └──────────────┘
```

**State flow:** `search → filter → customize → apply → record → done`

Claude decides which tools to call at each step via the `tool_use` API — the graph runs until Claude signals it's finished.

## Project Structure

```
JSA/
├── .env.example          # API key template
├── requirements.txt      # Python dependencies
├── README.md
└── job_search_agent/
    ├── __init__.py
    ├── main.py           # Entry point (CLI)
    ├── state.py          # LangGraph state definition + data models
    ├── graph.py          # LangGraph state machine
    ├── brain.py          # Claude API integration (tool_use loop)
    └── tools/
        ├── __init__.py
        ├── search.py     # Job search (mock / Tavily ready)
        ├── filter.py     # Relevance filtering
        ├── customize.py  # Resume tailoring (mock / Claude ready)
        ├── apply.py      # Application submission (mock / Playwright ready)
        └── record.py     # JSONL application log
```

## Quick Start

### 1. Clone & install

```bash
cd /path/to/JSA
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure API key

```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
```

### 3. Run

```bash
# Default search: "Python engineer remote"
python -m job_search_agent.main

# Custom query
python -m job_search_agent.main "machine learning engineer"

# With keywords for filtering
python -m job_search_agent.main "backend developer" --keywords python fastapi postgresql

# With a resume file
python -m job_search_agent.main "devops engineer" --resume ./my_resume.txt
```

## Tools (Current vs Planned)

| Tool            | Mock (v0.1)              | Planned Integration      |
|-----------------|--------------------------|--------------------------|
| `search_jobs`   | Hardcoded mock data      | **Tavily** API           |
| `filter_jobs`   | Keyword overlap scoring  | Claude-powered ranking   |
| `customize_resume` | Template placeholders | Claude rewrites resume   |
| `submit_application` | Dry-run simulation  | **Playwright** automation|
| `record_application` | JSONL append         | Database / spreadsheet   |

### Enabling Tavily Search

```bash
# In .env
TAVILY_API_KEY=tvly-xxxxx
```

Then uncomment the Tavily branch in `tools/search.py`.

### Enabling Auto-Apply (Playwright)

```bash
# In .env
AUTO_APPLY=true
pip install playwright
playwright install chromium
```

Then uncomment the Playwright branch in `tools/apply.py`.

## Configuration (.env)

| Variable            | Required | Default | Description                    |
|---------------------|----------|---------|--------------------------------|
| `ANTHROPIC_API_KEY` | ✅       | —       | Your Anthropic API key         |
| `TAVILY_API_KEY`    | ❌       | —       | For real web search            |
| `AUTO_APPLY`        | ❌       | `false` | Set `true` to actually submit  |
| `MAX_SEARCH_RESULTS`| ❌       | `10`    | Max jobs per search            |
| `MIN_MATCH_SCORE`   | ❌       | `0.6`   | Filter threshold (0–1)         |

## License

MIT
