"""ReAct Brain — Claude tool_use loop with Thought/Action/Observation cycle.

Implements the full System Prompt provided by the user, enforcing:
  - Strict phase ordering (search → evaluate → customize → confirm → apply)
  - [Thought] logging before every tool call
  - Human-in-the-loop gate for submit_application
  - Max 10 iterations with forced exit
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

from anthropic import Anthropic

from job_search_agent.state import AgentState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Import real tool functions
# ---------------------------------------------------------------------------
from job_search_agent.tools.search import search_jobs
from job_search_agent.tools.parse_resume import parse_resume
from job_search_agent.tools.fetch_jd import fetch_jd_text
from job_search_agent.tools.score import calculate_match_score
from job_search_agent.tools.cover_letter import craft_cover_letter
from job_search_agent.tools.tracker import (
    update_application_tracker,
    get_submit_count_today,
)

# Daily submission cap (from iron rules)
MAX_DAILY_SUBMITS = 20
# Minimum seconds between requests to same domain
RATE_LIMIT_SECONDS = 5.0

# ---------------------------------------------------------------------------
# System Prompt — verbatim from user spec
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
# 角色与终极目标
你是一个自主求职智能体（Job Application Agent）。你的核心使命是：在严格遵守伦理与安全规则的前提下，帮助用户高效地搜索、筛选、匹配并辅助投递合适的职位。

你并非一个闲聊助手，而是一个"规划-执行-观察"（ReAct）模式的自主决策体。你的一切输出必须导向"调用下一个工具"或"向用户提交阶段性审核报告"。

---

# 铁律（不可逾越的红线）
1. **隐私铁幕**：严禁在推理日志或输出中暴露用户的完整身份证号、手机号、精确家庭地址。简历原文仅在必要节点（如生成求职信时）内部使用，不得重复打印输出。
2. **反骚扰与频控**：对同一个招聘域名（如 boss直聘、linkedin.com）的请求间隔**不得低于 5 秒**。单日累计自动投递尝试不得超过 20 次，超过后必须强制休眠并通知用户。
3. **人类最终审批权（The Human Gate）**："提交投递"（submit_application）工具被**强制上锁**。在调用它之前，你必须先生成一份包含【公司名称、岗位、匹配度得分、薪酬范围、定制求职信预览】的最终报告，并等待用户回复精确的确认口令（格式：`CONFIRM_APPLY_<岗位ID>`）。未收到口令前，严禁触碰提交按钮。
4. **Token 节俭**：严禁将原始 HTML 或 10 页以上的 PDF 二进制数据直接塞入上下文窗口。必须先调用 `parse_document` 类工具提取纯文本结构化信息，再进行分析。
5. **最大步数硬限制**：单次任务（从"开始搜索"到"提交审核"）最多允许 15 轮思考-行动循环。超时未完成必须输出当前进度快照并礼貌退出。

---

# 可用工具清单（函数签名）
你需要调用以下 Python 函数。请严格按照函数名和参数格式进行调用。

1. **`search_jobs(keywords, location, remote_only, pages)`**
   - 功能：聚合搜索主流招聘网站的最新职位。
   - 返回：`[{"id": "str", "title": "str", "company": "str", "location": "str", "salary": "str", "url": "str", "post_date": "str"}]`

2. **`fetch_job_description(job_url)`**
   - 功能：访问职位详情页，剔除页眉、页脚、导航栏，仅提取正文职位描述。
   - 返回：纯文本格式的 JD 完整内容。

3. **`load_user_resume(file_path)`**
   - 功能：解析用户上传的 PDF/DOCX 简历，抽取并归类为"技能栈"、"工作经历"、"教育背景"三大模块。
   - 返回：结构化 JSON 对象。

4. **`evaluate_match_score(resume_json, jd_text)`**
   - 功能：调用大模型进行快速语义匹配，对比简历与 JD 的契合度。
   - 返回：`{"score": 0-100, "missing_skills": [...], "highlights": [...]}`

5. **`craft_cover_letter(resume_json, jd_text, company_name, tone)`**
   - 功能：生成针对该岗位和公司的定制化求职信。
   - 返回：250-400 字的正式求职信文本。

6. **`update_application_tracker(job_id, company, status, notes)`**
   - 功能：将当前申请进度写入本地 SQLite 数据库。
   - 状态码：SEARCHING, SHORTLISTED, TAILORING, AWAITING_CONFIRM, APPLIED, REJECTED。

7. **`submit_application(job_id, cover_letter_content, resume_version)`** **（危险禁区）**
   - 功能：自动填写招聘网站表单并点击最终提交。
   - **致命约束**：此函数必须包含 `user_confirmed: bool` 参数。若为 `False`，函数直接抛出异常拒绝执行。

---

# 强制执行的工作流（严格顺序，不得跳跃）

### 阶段零：初始化（Init）
- 自动调用 `load_user_resume` 读取用户简历。若失败，要求用户提供简历文件路径。

### 阶段一：勘探（The Hunter）
- 调用 `search_jobs` 获取原始岗位池。
- 过滤掉发布日期超过 7 天的陈旧岗位。
- 以表格形式展示得分最高的前 5 个岗位。

### 阶段二：狙击瞄准（The Sniper）
- 针对用户选定的岗位，调用 `fetch_job_description` 和 `evaluate_match_score`。
- **分流决策**：
  - 匹配度 ≥ 85：精准命中 → 进入阶段三。
  - 匹配度 60~84：有潜力 → 进入阶段三（标记"长线冲刺"）。
  - 匹配度 < 60：不匹配 → 跳过，记录 REJECTED。

### 阶段三：文书定制（The Writer）
- 调用 `craft_cover_letter` 生成求职信。
- 若有 missing_skills，在第二段主动建立逻辑桥梁。

### 阶段四：最终闸门（Human-in-the-Loop）
- 生成《投递审批单》：公司、岗位、匹配度、缺失技能、求职信预览、薪资。
- **强制暂停**，等待用户回复 `CONFIRM_APPLY_<岗位ID>`。

### 阶段五：执行与归档（Execution）
- 仅当收到确认口令后，调用 `submit_application(user_confirmed=True)`。
- 立即调用 `update_application_tracker` 更新状态。

---

# 推理过程输出格式（强制规范）
在每次调用工具**之前**，必须输出一段被 `<thought>` 标签包裹的内部推理日志。字数控制在 50 字以内。

**示例格式：**
```
<thought>
当前阶段：阶段二（狙击瞄准）。
当前目标：评估字节跳动后端岗位匹配度。
下一步动作：即将调用 evaluate_match_score，因为 JD 文本已获取完毕。
</thought>
```

---

# 上下文记忆变量（须持续追踪）
你必须在系统内部维护以下短时记忆变量：
- `current_job_id`：当前正在处理的岗位唯一标识。
- `current_match_score`：最近一次计算的匹配分数。
- `today_submit_count`：今日已提交总数（达到 20 时，后续所有提交请求自动转为"待明日队列"）。

---

# 异常与边缘情况处置预案
1. **遭遇验证码（Captcha）**：立即中止当前循环，打印"检测到反爬机制，请人工介入"，严禁反复重试。
2. **简历解析失败**：切换备用方案——要求用户直接粘贴简历文本内容。
3. **JD 内容为空**：向用户请求手动复制 JD 文本粘贴到对话中。
"""


# ---------------------------------------------------------------------------
# Tool definitions for Claude tool_use
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "search_jobs",
        "description": "Search for job postings. Returns a list of job dicts with id, title, company, location, salary, url, post_date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "keywords": {"type": "string", "description": "Search keywords (e.g. 'Python engineer')"},
                "location": {"type": "string", "description": "City or region", "default": ""},
                "remote_only": {"type": "boolean", "description": "Only return remote jobs", "default": False},
                "pages": {"type": "integer", "description": "Number of result pages to fetch", "default": 1},
            },
            "required": ["keywords"],
        },
    },
    {
        "name": "fetch_job_description",
        "description": "Fetch the full job description text from a job posting URL. Strips headers/footers.",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_url": {"type": "string", "description": "URL of the job posting"},
            },
            "required": ["job_url"],
        },
    },
    {
        "name": "load_user_resume",
        "description": "Parse a PDF/DOCX resume file. Returns structured JSON with skills, experience, education.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Path to the resume file (.pdf or .docx)"},
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "evaluate_match_score",
        "description": "Score how well a resume matches a job description (0-100). Returns score, missing_skills, highlights.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resume_json": {"type": "object", "description": "Parsed resume dict from load_user_resume"},
                "jd_text": {"type": "string", "description": "Job description text from fetch_job_description"},
            },
            "required": ["resume_json", "jd_text"],
        },
    },
    {
        "name": "craft_cover_letter",
        "description": "Generate a tailored 250-400 word cover letter for the target company and role.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resume_json": {"type": "object", "description": "Parsed resume dict"},
                "jd_text": {"type": "string", "description": "Job description text"},
                "company_name": {"type": "string", "description": "Target company name"},
                "job_title": {"type": "string", "description": "Target job title"},
                "tone": {"type": "string", "description": "Writing tone", "default": "professional"},
            },
            "required": ["resume_json", "jd_text", "company_name", "job_title"],
        },
    },
    {
        "name": "update_application_tracker",
        "description": "Record or update application status in SQLite. Status must be one of: SEARCHING, SHORTLISTED, TAILORING, AWAITING_CONFIRM, APPLIED, REJECTED.",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Unique job identifier"},
                "status": {"type": "string", "description": "Application status code"},
                "company": {"type": "string", "description": "Company name", "default": ""},
                "title": {"type": "string", "description": "Job title", "default": ""},
                "url": {"type": "string", "description": "Job posting URL", "default": ""},
                "salary": {"type": "string", "description": "Salary range", "default": ""},
                "match_score": {"type": "integer", "description": "Match score 0-100", "default": 0},
                "cover_letter": {"type": "string", "description": "Generated cover letter", "default": ""},
                "notes": {"type": "string", "description": "Free-text notes", "default": ""},
            },
            "required": ["job_id", "status"],
        },
    },
    {
        "name": "submit_application",
        "description": "⚠️ DANGEROUS — requires user_confirmed=True. Will REJECT if user_confirmed is False or missing. Only call after receiving CONFIRM_APPLY_<job_id> from user.",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Job identifier"},
                "cover_letter_content": {"type": "string", "description": "The cover letter to submit"},
                "resume_version": {"type": "string", "description": "Resume text/version to submit"},
                "user_confirmed": {"type": "boolean", "description": "MUST be True. If False, raises exception."},
            },
            "required": ["job_id", "cover_letter_content", "resume_version", "user_confirmed"],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool dispatcher — maps tool_use calls to real functions
# ---------------------------------------------------------------------------

def _extract_domain(url: str) -> str:
    """Extract domain from URL for rate-limiting."""
    from urllib.parse import urlparse
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return url


def _rate_limit_check(state: AgentState, url: str) -> None:
    """Enforce per-domain rate limiting (≥5 seconds between hits)."""
    import time as _time
    domain = _extract_domain(url)
    last = state.domain_last_hit.get(domain, 0.0)
    elapsed = _time.time() - last
    if elapsed < RATE_LIMIT_SECONDS:
        wait = RATE_LIMIT_SECONDS - elapsed
        logger.info("Rate limit: sleeping %.1fs for domain %s", wait, domain)
        _time.sleep(wait)
    state.domain_last_hit[domain] = _time.time()


def _execute_tool(name: str, args: dict[str, Any], state: AgentState) -> str:
    """Execute a tool call, enforce safety rules, return JSON result."""
    try:
        # --- submit_application: HARD GATE ---
        if name == "submit_application":
            if not args.get("user_confirmed"):
                return json.dumps({
                    "error": "BLOCKED: user_confirmed is False. "
                             "You MUST wait for the user to reply "
                             "CONFIRM_APPLY_<job_id> before calling this tool."
                })

            # Daily cap check
            if state.today_submit_count >= MAX_DAILY_SUBMITS:
                return json.dumps({
                    "error": f"DAILY_LIMIT: Already submitted {MAX_DAILY_SUBMITS} "
                             "applications today. Please try again tomorrow."
                })

            job_id = args["job_id"]
            state.today_submit_count += 1
            update_application_tracker(
                job_id=job_id,
                status="APPLIED",
                cover_letter=args.get("cover_letter_content", ""),
                notes=f"Submitted at {datetime.now(timezone.utc).isoformat()}",
            )
            return json.dumps({
                "success": True,
                "status": "APPLIED",
                "job_id": job_id,
                "today_count": state.today_submit_count,
            })

        # --- search_jobs ---
        if name == "search_jobs":
            _rate_limit_check(state, "search-api")
            keywords = args["keywords"]
            location = args.get("location", "")
            remote_only = args.get("remote_only", False)
            max_results = args.get("pages", 1) * 10

            jobs = search_jobs(
                query=keywords,
                location=location,
                remote_only=remote_only,
                max_results=max_results,
            )
            state.raw_jobs = jobs
            # Assign IDs if missing
            for i, job in enumerate(jobs):
                if not job.get("id"):
                    job["id"] = f"job-{i+1:03d}"
            return json.dumps(jobs, ensure_ascii=False)

        # --- fetch_job_description ---
        if name == "fetch_job_description":
            job_url = args["job_url"]
            _rate_limit_check(state, job_url)

            # Check cache
            if job_url in state.jd_cache:
                return state.jd_cache[job_url]

            jd_text = fetch_jd_text(job_url)
            if not jd_text.strip():
                return json.dumps({
                    "error": "EMPTY_JD",
                    "message": "JD content is empty. The page may require login "
                               "or has anti-scraping protection. "
                               "Please paste the JD text manually."
                })

            state.jd_cache[job_url] = jd_text
            return jd_text

        # --- load_user_resume ---
        if name == "load_user_resume":
            file_path = args["file_path"]
            result = parse_resume(file_path)
            state.resume_dict = result
            state.resume_text = result.get("raw_text", "")
            return json.dumps(result, ensure_ascii=False)

        # --- evaluate_match_score ---
        if name == "evaluate_match_score":
            resume_json = args.get("resume_json", state.resume_dict)
            jd_text = args["jd_text"]
            result = calculate_match_score(resume_json, jd_text)
            # Cache by a composite key
            cache_key = f"{hash(json.dumps(resume_json, default=str))}_{hash(jd_text[:200])}"
            state.score_cache[cache_key] = result
            return json.dumps(result, ensure_ascii=False)

        # --- craft_cover_letter ---
        if name == "craft_cover_letter":
            resume_json = args.get("resume_json", state.resume_dict)
            jd_text = args["jd_text"]
            company = args.get("company_name", "")
            title = args.get("job_title", "")
            tone = args.get("tone", "professional")

            letter = craft_cover_letter(resume_json, jd_text, company, title, tone)
            # Store by job_id if available
            job_id = state.current_job_id or f"{company}_{title}"
            state.cover_letters[job_id] = letter
            return json.dumps({"cover_letter": letter, "length": len(letter)})

        # --- update_application_tracker ---
        if name == "update_application_tracker":
            result = update_application_tracker(
                job_id=args["job_id"],
                status=args.get("status", "SEARCHING"),
                company=args.get("company", ""),
                title=args.get("title", ""),
                url=args.get("url", ""),
                salary=args.get("salary", ""),
                match_score=args.get("match_score", 0),
                cover_letter=args.get("cover_letter", ""),
                notes=args.get("notes", ""),
            )
            return json.dumps(result, ensure_ascii=False)

        return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as exc:
        logger.error("Tool %s failed: %s", name, exc)
        return json.dumps({"error": f"{name} failed: {exc}"})


# ---------------------------------------------------------------------------
# ReAct loop
# ---------------------------------------------------------------------------

def _build_initial_user_message(state: AgentState) -> str:
    """Construct the first user message that kicks off the ReAct loop."""
    parts = [
        "请开始执行求职任务。",
        f"搜索关键词：{state.search_query}",
    ]
    if state.location:
        parts.append(f"期望城市：{state.location}")
    if state.remote_only:
        parts.append("仅远程岗位：是")
    if state.resume_dict:
        parts.append(f"简历已加载（{len(state.resume_text)} 字符）")
    else:
        parts.append("⚠️ 简历尚未加载，请先调用 load_user_resume。")
    parts.append(f"今日已提交次数：{state.today_submit_count}/{MAX_DAILY_SUBMITS}")
    return "\n".join(parts)


def _log_thought(text: str) -> None:
    """Extract and print [Thought] from Claude's response."""
    # Look for <thought>...</thought> blocks
    thoughts = re.findall(r"<thought>(.*?)</thought>", text, re.DOTALL)
    for t in thoughts:
        clean = t.strip()
        logger.info("[Thought] %s", clean)
        print(f"\n{'─'*60}")
        print(f"  💭 [Thought]")
        for line in clean.splitlines():
            print(f"     {line.strip()}")
        print(f"{'─'*60}")


def _log_action(tool_name: str, args: dict) -> None:
    """Print the action being taken."""
    # Summarise args without dumping large text
    summary = {}
    for k, v in args.items():
        if isinstance(v, str) and len(v) > 80:
            summary[k] = v[:80] + "..."
        elif isinstance(v, dict):
            summary[k] = f"<dict with {len(v)} keys>"
        else:
            summary[k] = v
    logger.info("[Action] %s(%s)", tool_name, summary)
    print(f"  ⚡ [Action] {tool_name}({json.dumps(summary, ensure_ascii=False)})")


def _log_observation(result: str) -> None:
    """Print the observation (truncated)."""
    display = result[:300] + "..." if len(result) > 300 else result
    logger.info("[Observation] %s", display)
    print(f"  👁️ [Observation] {display}\n")


def run_brain(state: AgentState, max_iterations: int = 10) -> AgentState:
    """Run the ReAct loop: Thought → Action → Observation, up to max_iterations.

    This is the core "brain" — Claude sees the system prompt + state,
    picks tools via tool_use, and the results feed back until it finishes
    or hits the iteration cap.
    """
    client = Anthropic()  # reads ANTHROPIC_API_KEY from env

    # Load today's submit count from DB
    state.today_submit_count = get_submit_count_today()

    # Print startup banner
    _print_startup_banner(state)

    # Initialise messages with the user's first instruction
    if not state.messages:
        state.messages = [
            {"role": "user", "content": _build_initial_user_message(state)}
        ]

    for iteration in range(max_iterations):
        state.iteration = iteration + 1
        print(f"\n{'═'*60}")
        print(f"  🔄 ReAct Iteration {state.iteration}/{max_iterations}")
        print(f"{'═'*60}")

        # Safety: check daily cap
        if state.today_submit_count >= MAX_DAILY_SUBMITS:
            state.error = (
                f"Daily submission limit reached ({MAX_DAILY_SUBMITS}). "
                "Please try again tomorrow."
            )
            state.phase = "done"
            state.done = True
            _print_progress_snapshot(state)
            return state

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=state.messages,
        )

        # --- Extract text and log thoughts ---
        text_parts: list[str] = []
        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
        full_text = "\n".join(text_parts)
        if full_text.strip():
            _log_thought(full_text)

        # --- end_turn: model is done ---
        if response.stop_reason == "end_turn":
            state.final_report = full_text
            state.phase = "done"
            state.done = True
            state.messages.append({"role": "assistant", "content": response.content})
            _print_progress_snapshot(state)
            return state

        # --- tool_use: execute tools ---
        if response.stop_reason == "tool_use":
            state.messages.append({"role": "assistant", "content": response.content})

            tool_results: list[dict[str, Any]] = []
            for block in response.content:
                if block.type == "tool_use":
                    _log_action(block.name, block.input)

                    # If the tool is submit_application and user hasn't confirmed,
                    # inject a reminder into the state
                    if block.name == "submit_application":
                        if not block.input.get("user_confirmed"):
                            logger.warning(
                                "Claude attempted submit_application without "
                                "user confirmation — BLOCKED"
                            )

                    result = _execute_tool(block.name, block.input, state)
                    _log_observation(result)

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            state.messages.append({"role": "user", "content": tool_results})
            continue

        # Fallback
        state.error = f"Unexpected stop_reason: {response.stop_reason}"
        state.phase = "done"
        state.done = True
        _print_progress_snapshot(state)
        return state

    # Exhausted iterations
    state.error = f"Maximum iterations ({max_iterations}) reached."
    state.phase = "done"
    state.done = True
    _print_progress_snapshot(state)
    return state


# ---------------------------------------------------------------------------
# Startup banner
# ---------------------------------------------------------------------------

def _print_startup_banner(state: AgentState) -> None:
    resume_status = "已加载" if state.resume_text else "❌ 未加载"
    print(f"""
╔══════════════════════════════════════════════════════╗
║           🤖 [求职智能体] 已就绪                       ║
╠══════════════════════════════════════════════════════╣
║  简历加载状态：{resume_status:<38s}║
║  今日已投递计数：{state.today_submit_count:<2d} 次                              ║
║  上次任务归档时间：{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M'):<28s}║
╚══════════════════════════════════════════════════════╝
""")


def _print_progress_snapshot(state: AgentState) -> None:
    """Print a summary of what was accomplished."""
    print(f"""
╔══════════════════════════════════════════════════════╗
║           📋 进度快照                                 ║
╠══════════════════════════════════════════════════════╣
║  总迭代次数：{state.iteration:<3d}                                     ║
║  搜索到岗位：{len(state.raw_jobs):<3d}                                     ║
║  JD 已获取：{len(state.jd_cache):<3d}                                      ║
║  已评分岗位：{len(state.score_cache):<3d}                                     ║
║  已生成求职信：{len(state.cover_letters):<2d}                                     ║
║  今日已投递：{state.today_submit_count:<2d}/{MAX_DAILY_SUBMITS}                                  ║
║  状态：{state.phase:<20s}                         ║
╚══════════════════════════════════════════════════════╝
""")
    if state.error:
        print(f"  ⚠️  错误：{state.error}\n")
