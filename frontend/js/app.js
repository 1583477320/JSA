/* ============================================================
   JSA — Job Search Agent
   i18n: en/zh toggle, settings persistence, chat with context
   ============================================================ */

const JSA = (() => {
  'use strict';

  // ================================================================
  //  i18n — translations
  // ================================================================
  const LANG_KEY = 'jsa_lang';
  const _tr = {
    en: {
      'lang.name': 'EN',
      'lang.alt': '中文',
      'brand.suffix': 'Job Search Agent',
      'badge.version': 'v0.1',
      'hero.title': 'Find your next role,<br>matched to your skills',
      'hero.subtitle': 'AI-powered job matching that scores each position against your resume — so you only apply where you’re a strong fit.',
      'search.placeholder': 'Job title, skills, or keywords...',
      'location.placeholder': 'City or remote',
      'search.remote': 'Remote only',
      'search.btn': 'Search',
      'results.title': 'Results',
      'results.count': '{n} position{s} found',
      'results.loading': 'Searching for matching positions...',
      'results.empty.title': 'No jobs found',
      'results.empty.desc': 'Try adjusting your search keywords or location to find more opportunities.',
      'card.posted': 'Posted',
      'card.view': 'View →',
      'card.remote': 'Remote',
      'card.match': 'Match score',
      'detail.tab.overview': 'Overview',
      'detail.tab.chat': 'Chat',
      'detail.tab.chat_badge': 'Ask AI',
      'detail.match.title': 'Match Score',
      'detail.match.desc': 'Based on skills overlap, experience relevance, and location alignment',
      'detail.section.desc': 'Description',
      'detail.section.details': 'Details',
      'detail.section.missing': 'Missing Skills',
      'detail.btn.open': 'Open Posting',
      'detail.btn.chat': 'Ask AI About This Job',
      'detail.btn.save': 'Save to Tracker',
      'detail.chat.context': 'Chatting about <strong>{title}</strong> at <strong>{company}</strong>',
      'detail.chat.placeholder': 'Ask about salary, interview tips, skills...',
      'detail.chat.send': 'Send',
      'chat.label': 'JSA',
      'chat.initial': 'I’ve analyzed the **{title}** role at **{company}**. Feel free to ask me anything — salary, interview tips, cover letter advice, or how well you match!',
      'settings.title': 'Settings',
      'settings.llm': 'LLM Configuration',
      'settings.llm.desc': 'Configure the AI model used for matching and chat. Supports any OpenAI-compatible API.',
      'settings.key': 'OpenAI API Key',
      'settings.base_url': 'OpenAI Base URL',
      'settings.model': 'Model',
      'settings.search': 'Search',
      'settings.tavily': 'Tavily API Key',
      'settings.anthropic': 'Anthropic API Key',
      'settings.max_results': 'Max Results',
      'settings.save': 'Save Settings',
      'settings.reset': 'Reset',
      'settings.saved': '✅ Settings saved',
      'settings.reset_msg': '↺ Reset to defaults',
      'footer': 'Job Search Agent · Powered by Claude + LangGraph',
      'profile.title': 'Profile',
      'profile.desc': 'Fill in your resume info — AI will use it to score job matches.',
      'profile.skills': 'Skills (comma-separated)',
      'profile.experience': 'Work Experience',
      'profile.education': 'Education',
      'profile.save': 'Save Profile',
      'profile.reset': 'Clear',
      'profile.saved': '✅ Profile saved',
      'profile.cleared': '↺ Profile cleared',
    },
    zh: {
      'lang.name': '中',
      'lang.alt': 'English',
      'brand.suffix': '求职智能体',
      'badge.version': 'v0.1',
      'hero.title': '找到你的下一个职位，<br>与你的技能精准匹配',
      'hero.subtitle': 'AI 驱动的职位匹配引擎，将每个岗位与你的简历进行打分——只投递最适合你的机会。',
      'search.placeholder': '职位、技能或关键词...',
      'location.placeholder': '城市或远程',
      'search.remote': '仅远程',
      'search.btn': '搜索',
      'results.title': '搜索结果',
      'results.count': '找到 {n} 个职位',
      'results.loading': '正在搜索匹配的职位...',
      'results.empty.title': '未找到职位',
      'results.empty.desc': '尝试调整搜索关键词或地点，以发现更多机会。',
      'card.posted': '发布于',
      'card.view': '查看 →',
      'card.remote': '远程',
      'card.match': '匹配分数',
      'detail.tab.overview': '概览',
      'detail.tab.chat': '对话',
      'detail.tab.chat_badge': '问 AI',
      'detail.match.title': '匹配分数',
      'detail.match.desc': '基于技能重合度、经验相关性和地点匹配度计算',
      'detail.section.desc': '职位描述',
      'detail.section.details': '详细信息',
      'detail.section.missing': '缺失技能',
      'detail.btn.open': '打开职位',
      'detail.btn.chat': '向 AI 咨询此职位',
      'detail.btn.save': '保存到追踪器',
      'detail.chat.context': '正在讨论 <strong>{title}</strong> — <strong>{company}</strong>',
      'detail.chat.placeholder': '询问薪资、面试技巧、技能...',
      'detail.chat.send': '发送',
      'chat.label': '求职智能体',
      'chat.initial': '我已经分析了 **{title}** 岗位在 **{company}**。可以问我任何问题——薪资、面试技巧、求职信建议，或者匹配度如何！',
      'settings.title': '设置',
      'settings.llm': '大模型配置',
      'settings.llm.desc': '配置用于匹配和对话的 AI 模型。支持任何 OpenAI 兼容的 API。',
      'settings.key': 'OpenAI API 密钥',
      'settings.base_url': 'OpenAI 接口地址',
      'settings.model': '模型名称',
      'settings.search': '搜索',
      'settings.tavily': 'Tavily API 密钥',
      'settings.anthropic': 'Anthropic API 密钥',
      'settings.max_results': '最大结果数',
      'settings.save': '保存设置',
      'settings.reset': '恢复默认',
      'settings.saved': '✅ 设置已保存',
      'settings.reset_msg': '↺ 已恢复默认设置',
      'footer': '求职智能体 · 由 Claude + LangGraph 驱动',
      'profile.title': '个人简历',
      'profile.desc': '填写你的简历信息，AI 会据此分析岗位匹配度。',
      'profile.skills': '技能（逗号分隔）',
      'profile.experience': '工作经验',
      'profile.education': '教育背景',
      'profile.save': '保存简历',
      'profile.reset': '清空',
      'profile.saved': '✅ 简历已保存',
      'profile.cleared': '↺ 简历已清空',
    },
  };

  function t(key, ...args) {
    const lang = state.lang;
    let str = (_tr[lang] && _tr[lang][key]) || (_tr.en[key]) || key;
    // simple interpolation: {n}, {s}, {title}, etc.
    args.forEach(arg => {
      if (typeof arg === 'object') {
        for (const [k, v] of Object.entries(arg)) {
          str = str.replace(`{${k}}`, v);
        }
      } else {
        str = str.replace(/\{[^}]+\}/, arg);
      }
    });
    return str;
  }

  // ================================================================
  //  State
  // ================================================================
  const state = {
    lang: 'en',
    jobs: [],
    loading: false,
    error: null,
    selectedJob: null,
    chatMessages: [],
    chatHistory: {},
    settings: {},
    profile: {},
    activeTab: 'overview',
    selectedCategories: [],
  };

  let els = {};

  // ================================================================
  //  Language
  // ================================================================
  function _loadLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'zh' || saved === 'en') state.lang = saved;
    } catch { /* ignore */ }
  }

  function _saveLang() {
    try { localStorage.setItem(LANG_KEY, state.lang); } catch { /* ignore */ }
  }

  function toggleLang() {
    state.lang = state.lang === 'en' ? 'zh' : 'en';
    _saveLang();
    _applyLangUI();
  }

  function _applyLangUI() {
    // Update lang toggle button text
    if (els.langToggle) els.langToggle.textContent = t('lang.alt');

    // Update all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // Re-render search results and detail if open
    if (state.jobs.length > 0 || state.loading || state.error) {
      renderResults();
    }
    // If detail modal is open, refresh it
    if (state.selectedJob) {
      const overlay = document.querySelector('.modal-overlay');
      if (overlay) {
        const job = state.selectedJob;
        closeDetail();
        setTimeout(() => openDetail(job), 50);
      }
    }
  }

  // ================================================================
  //  Settings
  // ================================================================
  const SETTINGS_KEY = 'jsa_settings';
  const DEFAULT_SETTINGS = {
    openaiApiKey: '', openaiBaseUrl: 'https://api.openai.com/v1', openaiModel: 'gpt-4o-mini',
    tavilyApiKey: '', anthropicApiKey: '', maxResults: 10,
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      state.settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch { state.settings = { ...DEFAULT_SETTINGS }; }
  }

  function saveSettings() {
    const s = {
      openaiApiKey: els.sOpenAiKey.value.trim(),
      openaiBaseUrl: els.sBaseUrl.value.trim() || DEFAULT_SETTINGS.openaiBaseUrl,
      openaiModel: els.sModel.value.trim() || DEFAULT_SETTINGS.openaiModel,
      tavilyApiKey: els.sTavilyKey.value.trim(),
      anthropicApiKey: els.sAnthropicKey.value.trim(),
      maxResults: parseInt(els.sMaxResults.value, 10) || DEFAULT_SETTINGS.maxResults,
    };
    state.settings = s;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    _showSettingsStatus(t('settings.saved'), 'ok');
  }

  function resetSettings() {
    state.settings = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(SETTINGS_KEY);
    _populateSettingsForm();
    _showSettingsStatus(t('settings.reset_msg'), 'ok');
  }

  function _populateSettingsForm() {
    const s = state.settings;
    els.sOpenAiKey.value = s.openaiApiKey || '';
    els.sBaseUrl.value = s.openaiBaseUrl || '';
    els.sModel.value = s.openaiModel || '';
    els.sTavilyKey.value = s.tavilyApiKey || '';
    els.sAnthropicKey.value = s.anthropicApiKey || '';
    els.sMaxResults.value = s.maxResults || 10;
  }

  function _showSettingsStatus(msg, cls) {
    els.settingsStatus.textContent = msg;
    els.settingsStatus.className = 'settings-status ' + (cls || '');
    setTimeout(() => { if (els.settingsStatus.textContent === msg) els.settingsStatus.textContent = ''; }, 3000);
  }

  function openSettings() {
    _populateSettingsForm();
    els.settingsOverlay.classList.add('open');
    els.settingsOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeSettings() {
    els.settingsOverlay.classList.remove('open');
    els.settingsOverlay.setAttribute('aria-hidden', 'true');
  }

  // ================================================================
  //  Profile
  // ================================================================
  const PROFILE_KEY = 'jsa_profile';
  const DEFAULT_PROFILE = { skills: '', experience: '', education: '' };

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      state.profile = raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
    } catch { state.profile = { ...DEFAULT_PROFILE }; }
  }

  function saveProfile() {
    const p = {
      skills: els.pSkills.value.trim(),
      experience: els.pExperience.value.trim(),
      education: els.pEducation.value.trim(),
    };
    state.profile = p;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    _showProfileStatus(t('profile.saved'), 'ok');
  }

  function resetProfile() {
    state.profile = { ...DEFAULT_PROFILE };
    localStorage.removeItem(PROFILE_KEY);
    _populateProfileForm();
    _showProfileStatus(t('profile.cleared'), 'ok');
  }

  function _populateProfileForm() {
    const p = state.profile;
    els.pSkills.value = p.skills || '';
    els.pExperience.value = p.experience || '';
    els.pEducation.value = p.education || '';
  }

  function _showProfileStatus(msg, cls) {
    els.profileStatus.textContent = msg;
    els.profileStatus.className = 'settings-status ' + (cls || '');
    setTimeout(() => { if (els.profileStatus.textContent === msg) els.profileStatus.textContent = ''; }, 3000);
  }

  function openProfile() {
    _populateProfileForm();
    els.profileOverlay.classList.add('open');
    els.profileOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeProfile() {
    els.profileOverlay.classList.remove('open');
    els.profileOverlay.setAttribute('aria-hidden', 'true');
  }

  // ================================================================
  //  Match scoring via LLM
  // ================================================================
  async function _scoreJob(job) {
    const p = state.profile;
    const s = state.settings;
    if (!s.openaiApiKey) return;
    if (!job.snippet && !job.description) return;

    const isZh = state.lang === 'zh';
    const jdText = job.snippet || job.description || '';
    const skillsList = p.skills || (isZh ? '未填写' : 'Not provided');
    const expText = p.experience || (isZh ? '未填写' : 'Not provided');
    const eduText = p.education || (isZh ? '未填写' : 'Not provided');

    const prompt = isZh
      ? `你是技术招聘专家。分析以下简历和岗位的匹配度。

## 简历
技能：${skillsList}
经验：${expText}
学历：${eduText}

## 岗位信息
公司：${job.company}  职位：${job.title}
描述：${jdText.slice(0, 1000)}

严格返回如下 JSON（不要加 markdown 标记）：
{"score":0-100,"missing_skills":["技能1"],"matching_skills":["技能2"],"summary":"一句话评估"}`
      : `You are a technical recruiter. Analyze the match between this resume and the job.

## Resume
Skills: ${skillsList}
Experience: ${expText}
Education: ${eduText}

## Job Info
Company: ${job.company}  Title: ${job.title}
Description: ${jdText.slice(0, 1000)}

Return exactly this JSON (no markdown):
{"score":0-100,"missing_skills":["skill1"],"matching_skills":["skill2"],"summary":"one sentence assessment"}`;

    try {
      const baseUrl = (s.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: s.openaiModel || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: isZh ? '你是精准的技术招聘评分专家。只返回 JSON。' : 'You are a precise technical scoring expert. Return JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 512,
        }),
      });

      if (!resp.ok) return;
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const result = JSON.parse(cleaned);

      job.match_score = Math.max(0, Math.min(100, result.score || 0));
      job.missing_skills = Array.isArray(result.missing_skills) ? result.missing_skills : [];
    } catch {
      // Scoring failed silently — keep score at 0
    }
  }

  // ================================================================
  //  SVG score ring
  // ================================================================
  function buildScoreRing(score, size = 48) {
    const r = (size / 2) - 6;
    const circ = 2 * Math.PI * r;
    const offset = circ - Math.min(score, 100) / 100 * circ;
    const cls = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
    return `<svg viewBox="0 0 ${size} ${size}" aria-label="${t('card.match')} ${score}%">
      <circle class="bg"  cx="${size/2}" cy="${size/2}" r="${r}"/>
      <circle class="fg ${cls}" cx="${size/2}" cy="${size/2}" r="${r}"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
              style="transition: stroke-dashoffset 0.6s cubic-bezier(.22,1,.36,1)"/>
      <text x="${size/2}" y="${size/2}" class="${cls}">${score}%</text>
    </svg>`;
  }

  async function searchJobs(query, location, remoteOnly) {
    const s = state.settings;
    const resp = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query || '',
        location: location || '',
        remoteOnly: !!remoteOnly,
        maxResults: s.maxResults || 10,
        tavilyApiKey: s.tavilyApiKey || '',
        categories: state.selectedCategories,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `API error ${resp.status}`);
    }
    const data = await resp.json();
    return data.jobs || [];
  }

  // ================================================================
  //  Chat engine — bilingual
  // ================================================================
  const _chatContexts = {
    'job-001': {
      factsEn: ['Python', 'FastAPI', 'SQLAlchemy', 'AWS', 'microservices'],
      factsZh: ['Python', 'FastAPI', 'SQLAlchemy', 'AWS', '微服务'],
    },
    'job-002': {
      factsEn: ['PyTorch', 'Kubeflow', 'Kubernetes', 'MLOps'],
      factsZh: ['PyTorch', 'Kubeflow', 'Kubernetes', 'MLOps'],
    },
    'job-003': {
      factsEn: ['PostgreSQL', 'Redis', 'distributed systems', 'e-commerce'],
      factsZh: ['PostgreSQL', 'Redis', '分布式系统', '电商'],
    },
    'job-004': {
      factsEn: ['Spark', 'Airflow', 'dbt', 'Snowflake', 'ETL'],
      factsZh: ['Spark', 'Airflow', 'dbt', 'Snowflake', 'ETL'],
    },
    'job-005': {
      factsEn: ['Terraform', 'AWS', 'GCP', 'Kubernetes', 'CI/CD'],
      factsZh: ['Terraform', 'AWS', 'GCP', 'Kubernetes', 'CI/CD'],
    },
    'job-006': {
      factsEn: ['React', 'Python', 'Django', 'full-stack'],
      factsZh: ['React', 'Python', 'Django', '全栈'],
    },
  };

  function _getChatContext(job) {
    return _chatContexts[job.id] || {
      factsEn: ['software engineering', 'technology'],
      factsZh: ['软件工程', '技术'],
    };
  }

  function _buildChatSystem(job) {
    const isZh = state.lang === 'zh';
    const ctx = _getChatContext(job);
    const tech = isZh ? ctx.factsZh.join(', ') : ctx.factsEn.join(', ');
    const missing = job.missing_skills?.join(', ') || (isZh ? '无' : 'none');

    return isZh
      ? `你是 JSA（求职智能体），帮助求职者分析岗位和准备面试。

当前岗位信息：
- 公司：${job.company}
- 职位：${job.title}
- 描述：${job.snippet || job.description || '暂无'}
- 薪资：${job.salary || '未提供'}
- 地点：${job.location || '未提供'}
- 匹配分数：${job.match_score}%
- 相关技术：${tech}
- 缺失技能：${missing}

规则：
1. 用中文回答，简洁直接
2. 基于岗位信息给出具体建议
3. 如果被问到前面聊过的内容，引用之前的对话
4. 需要时用 markdown 格式（加粗、列表等）
5. 保持专业但友好的语气`
      : `You are JSA (Job Search Agent), helping job seekers analyze positions and prepare for interviews.

Current job info:
- Company: ${job.company}
- Title: ${job.title}
- Description: ${job.snippet || job.description || 'Not available'}
- Salary: ${job.salary || 'Not provided'}
- Location: ${job.location || 'Not provided'}
- Match score: ${job.match_score}%
- Relevant tech: ${tech}
- Missing skills: ${missing}

Rules:
1. Answer concisely and directly
2. Give specific advice based on the job info
3. When asked about previous topics, reference earlier messages
4. Use markdown formatting when helpful (bold, lists)
5. Be professional but approachable`;
  }

  async function _chatReply(job) {
    const s = state.settings;
    const baseUrl = s.openaiBaseUrl || 'https://api.openai.com/v1';
    const apiKey  = s.openaiApiKey || '';
    const model   = s.openaiModel || 'gpt-4o-mini';

    if (!apiKey) throw new Error(state.lang === 'zh'
      ? '请先在 Settings 中配置 OpenAI API Key'
      : 'Please configure OpenAI API Key in Settings first');

    const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const systemPrompt = _buildChatSystem(job);

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...state.chatMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages: apiMessages, temperature: 0.7, max_tokens: 1024 }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async function sendChatMessage(job) {
    const input = els.chatInput;
    const text = input.value.trim();
    if (!text) return;
    state.chatMessages.push({ role: 'user', content: text });
    _renderChatMessages(job);
    input.value = '';
    els.chatSend.disabled = true;

    const container = els.chatMessages;
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg typing';
    typingEl.id = 'chatTyping';
    typingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    container.appendChild(typingEl);
    container.scrollTop = container.scrollHeight;

    try {
      const reply = await _chatReply(job);
      state.chatMessages.push({ role: 'assistant', content: reply });
    } catch (err) {
      state.chatMessages.push({ role: 'assistant', content: `⚠️ ${err.message}` });
    } finally {
      const tEl = document.getElementById('chatTyping');
      if (tEl) tEl.remove();
      _renderChatMessages(job);
      els.chatSend.disabled = false;
      els.chatInput.focus();
    }
  }

  function _renderChatMessages(job) {
    const container = els.chatMessages;
    const typing = document.getElementById('chatTyping');
    const contextBar = container.parentElement.querySelector('.chat-context');
    container.innerHTML = '';
    if (contextBar) container.parentElement.insertBefore(contextBar, container);

    state.chatMessages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `chat-msg ${msg.role}`;
      div.innerHTML = msg.role === 'assistant'
        ? `<div class="msg-label">${t('chat.label')}</div>${_md(msg.content)}`
        : _md(msg.content);
      container.appendChild(div);
    });
    if (typing) container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  function _md(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // ================================================================
  //  Render results
  // ================================================================
  function renderResults() {
    const { jobs: allJobs, loading, error } = state;
    els.results.innerHTML = '';

    if (loading) {
      els.results.innerHTML = `<div class="results-loading"><div class="spinner"></div><p>${t('results.loading')}</p></div>`;
      return;
    }
    if (error) {
      els.results.innerHTML = `<div class="results-error"><p>⚠️ ${escapeHtml(error)}</p></div>`;
      return;
    }
    if (allJobs.length === 0) {
      els.results.innerHTML = `<div class="results-empty"><div class="empty-icon">🔍</div><h3>${t('results.empty.title')}</h3><p>${t('results.empty.desc')}</p></div>`;
      return;
    }

    const jobs = allJobs;
    els.resultsCount.textContent = t('results.count', { n: jobs.length, s: jobs.length > 1 ? 's' : '' });

    // ---- Job grid ----
    const grid = document.createElement('div');
    grid.className = 'job-grid';

    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.dataset.jobId = job.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${job.title} at ${job.company}`);
      card.addEventListener('click', () => openDetail(job));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(job); });

      const postedLabel = t('card.posted');
      const viewLabel = t('card.view');
      card.innerHTML = `
        <div class="job-card-top">
          <div>
            <div class="job-card-company">${escapeHtml(job.company)}</div>
            <div class="job-card-title">${escapeHtml(job.title)}</div>
          </div>
          <div class="score-ring" title="${t('card.match')}: ${job.match_score}%">${buildScoreRing(job.match_score)}</div>
        </div>
        <div class="job-card-tags">
          ${job.location ? `<span class="tag location">📍 ${escapeHtml(job.location)}</span>` : ''}
          ${job.salary ? `<span class="tag salary">💰 ${escapeHtml(job.salary)}</span>` : ''}
        </div>
        <div class="job-card-snippet">${escapeHtml(job.snippet)}</div>
        <div class="job-card-footer">
          <span class="job-card-date">${postedLabel} ${job.post_date}</span>
          <button class="job-card-btn">${viewLabel}</button>
        </div>`;
      grid.appendChild(card);
    });
    els.results.appendChild(grid);
  }

  // ================================================================
  //  Detail modal
  // ================================================================
  function openDetail(job) {
    state.selectedJob = job;
    state.chatMessages = state.chatHistory[job.id] || [
      { role: 'assistant', content: t('chat.initial', { title: job.title, company: job.company }) },
    ];
    state.chatHistory[job.id] = state.chatMessages;
    state.activeTab = 'overview';

    const scoreCls = job.match_score >= 80 ? 'high' : job.match_score >= 60 ? 'medium' : 'low';
    const missingBadges = (job.missing_skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDetail(); });

    overlay.innerHTML = `
      <div class="modal detail-wide" role="dialog" aria-modal="true" aria-label="Job details">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(job.title)}</h2>
            <div class="company">${escapeHtml(job.company)}</div>
          </div>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-tabs" role="tablist">
          <button class="modal-tab active" data-tab="overview" role="tab">📋 ${t('detail.tab.overview')}</button>
          <button class="modal-tab" data-tab="chat" role="tab">💬 ${t('detail.tab.chat')} <span class="navbar-badge" style="font-size:.65rem">${t('detail.tab.chat_badge')}</span></button>
        </div>
        <div class="modal-panel active" id="panelOverview" role="tabpanel">
          <div class="modal-body">
            <div class="modal-match">
              <div class="score-ring">${buildScoreRing(job.match_score, 64)}</div>
              <div class="match-details">
                <h4>${t('detail.match.title')}: <span class="${scoreCls}">${job.match_score}%</span></h4>
                <p>${t('detail.match.desc')}</p>
              </div>
            </div>
            <h3>${t('detail.section.desc')}</h3>
            <div class="desc-text">${escapeHtml(job.snippet || job.description || '')}</div>
            <h3>${t('detail.section.details')}</h3>
            <p>📍 ${escapeHtml(job.location)} &nbsp;·&nbsp; 💰 ${escapeHtml(job.salary)}</p>
            <h3>${t('detail.section.missing')}</h3>
            <div class="missing-skills">${missingBadges || (job.match_score === 0 ? '<span class="tag" style="opacity:.5">…</span>' : '')}</div>
            <div class="modal-actions">
              <button class="btn btn-primary open-url">🔗 ${t('detail.btn.open')}</button>
              <button class="btn btn-secondary" id="chatFromOverview">💬 ${t('detail.btn.chat')}</button>
              <button class="btn btn-secondary">💾 ${t('detail.btn.save')}</button>
            </div>
          </div>
        </div>
        <div class="modal-panel" id="panelChat" role="tabpanel">
          <div class="modal-body">
            <div class="chat-context">
              <span>💼</span> ${t('detail.chat.context', { title: escapeHtml(job.title), company: escapeHtml(job.company) })}
            </div>
            <div class="chat-container">
              <div class="chat-messages"></div>
              <div class="chat-input-area">
                <input type="text" placeholder="${t('detail.chat.placeholder')}" autocomplete="off">
                <button class="chat-send" aria-label="${t('detail.chat.send')}">➤</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.modal');

    modal.querySelector('.modal-close').addEventListener('click', closeDetail);
    document.addEventListener('keydown', _onEsc);

    modal.querySelector('.open-url')?.addEventListener('click', () => {
      window.open(job.url, '_blank', 'noopener');
    });

    // Trigger scoring if not yet scored
    if (job.match_score === 0 && (state.profile.skills || state.profile.experience)) {
      const scoreRingEl = modal.querySelector('.score-ring');
      const missingEl = modal.querySelector('.missing-skills');
      _scoreJob(job).then(() => {
        if (scoreRingEl) scoreRingEl.innerHTML = buildScoreRing(job.match_score, 64);
        if (missingEl && job.missing_skills?.length) {
          missingEl.innerHTML = job.missing_skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('');
        }
        // Update card in results list
        const card = document.querySelector(`[data-job-id="${job.id}"] .score-ring`);
        if (card) card.innerHTML = buildScoreRing(job.match_score);
      });
    }

    modal.querySelectorAll('.modal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
        const panel = modal.querySelector(`#panel${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`);
        if (panel) panel.classList.add('active');
        state.activeTab = btn.dataset.tab;
        if (btn.dataset.tab === 'chat') _initChat(job, modal);
      });
    });

    modal.querySelector('#chatFromOverview')?.addEventListener('click', () => {
      modal.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
      modal.querySelector('[data-tab="chat"]')?.classList.add('active');
      modal.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
      const panel = modal.querySelector('#panelChat');
      if (panel) panel.classList.add('active');
      state.activeTab = 'chat';
      _initChat(job, modal);
    });

    setTimeout(() => modal.querySelector('.modal-close')?.focus(), 100);
  }

  function _initChat(job, modal) {
    const container = modal.querySelector('.chat-messages');
    const input = modal.querySelector('.chat-input-area input');
    const sendBtn = modal.querySelector('.chat-send');

    els.chatMessages = container;
    els.chatInput = input;
    els.chatSend = sendBtn;

    state.chatMessages = state.chatHistory[job.id] || state.chatMessages;
    state.chatHistory[job.id] = state.chatMessages;
    _renderChatMessages(job);

    const newSend = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSend, sendBtn);
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    els.chatSend = newSend;
    els.chatInput = newInput;

    const send = () => sendChatMessage(job);
    els.chatSend.addEventListener('click', send);
    els.chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    els.chatInput.focus();
  }

  function closeDetail() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _onEsc);
    state.selectedJob = null;
  }

  function _onEsc(e) { if (e.key === 'Escape') closeDetail(); }

  // ================================================================
  //  Utilities
  // ================================================================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Pre-search category dropdown --------------------------------
  const SEARCH_CHIPS = [
    { id: 'BOSS直聘', label: 'BOSS直聘' },
    { id: '猎聘',     label: '猎聘' },
    { id: '拉钩',     label: '拉钩' },
    { id: '智联招聘', label: '智联招聘' },
    { id: 'LinkedIn', label: 'LinkedIn' },
    { id: '大厂',     label: '🏢 大厂' },
    { id: '外企',     label: '🌍 外企' },
  ];

  function renderCategoryChips() {
    els.categoryChips.innerHTML = '';

    // Container
    const wrap = document.createElement('div');
    wrap.className = 'cat-dropdown-wrap';

    // Trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cat-trigger';
    const count = state.selectedCategories.length;
    trigger.innerHTML = count > 0
      ? `🏷️ 已选 ${count} 个分类 <span class="caret">▾</span>`
      : `🏷️ 分类筛选 <span class="caret">▾</span>`;
    wrap.appendChild(trigger);

    // Dropdown panel
    const panel = document.createElement('div');
    panel.className = 'cat-panel';
    SEARCH_CHIPS.forEach((chip) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = `cat-opt${state.selectedCategories.includes(chip.id) ? ' active' : ''}`;
      opt.innerHTML = `<span class="cat-check">${state.selectedCategories.includes(chip.id) ? '✓' : ''}</span> ${chip.label}`;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = state.selectedCategories.indexOf(chip.id);
        if (idx === -1) state.selectedCategories.push(chip.id);
        else state.selectedCategories.splice(idx, 1);
        renderCategoryChips();
      });
      panel.appendChild(opt);
    });
    wrap.appendChild(panel);

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    // Close on outside click
    const closeHandler = (e) => {
      if (!wrap.contains(e.target)) {
        panel.classList.remove('open');
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);

    els.categoryChips.appendChild(wrap);
  }

  async function handleSearch(e) {
    if (e) e.preventDefault();
    const query = els.searchInput.value.trim();
    const location = els.locationInput.value.trim();
    const remoteOnly = els.remoteToggle.checked;
    if (!query) { els.searchInput.focus(); return; }
    state.loading = true; state.error = null;
    renderResults();
    try { state.jobs = await searchJobs(query, location, remoteOnly); }
    catch (err) { state.error = err.message || 'Search failed.'; }
    finally { state.loading = false; renderResults(); }
  }

  // ================================================================
  //  Init
  // ================================================================
  function init() {
    _loadLang();

    els = {
      searchForm:      document.getElementById('searchForm'),
      searchInput:     document.getElementById('searchInput'),
      locationInput:   document.getElementById('locationInput'),
      remoteToggle:    document.getElementById('remoteToggle'),
      results:         document.getElementById('results'),
      resultsCount:    document.getElementById('resultsCount'),
      resultsHeader:   document.getElementById('resultsHeader'),
      settingsOverlay: document.getElementById('settingsOverlay'),
      settingsBtn:     document.getElementById('settingsBtn'),
      settingsClose:   document.getElementById('settingsClose'),
      settingsSave:    document.getElementById('settingsSave'),
      settingsReset:   document.getElementById('settingsReset'),
      settingsStatus:  document.getElementById('settingsStatus'),
      sOpenAiKey:      document.getElementById('sOpenAiKey'),
      sBaseUrl:        document.getElementById('sBaseUrl'),
      sModel:          document.getElementById('sModel'),
      sTavilyKey:      document.getElementById('sTavilyKey'),
      sAnthropicKey:   document.getElementById('sAnthropicKey'),
      sMaxResults:     document.getElementById('sMaxResults'),
      langToggle:      document.getElementById('langToggle'),
      categoryChips:   document.getElementById('categoryChips'),
      profileBtn:      document.getElementById('profileBtn'),
      profileOverlay:  document.getElementById('profileOverlay'),
      profileClose:    document.getElementById('profileClose'),
      profileSave:     document.getElementById('profileSave'),
      profileReset:    document.getElementById('profileReset'),
      profileStatus:   document.getElementById('profileStatus'),
      pSkills:         document.getElementById('pSkills'),
      pExperience:     document.getElementById('pExperience'),
      pEducation:      document.getElementById('pEducation'),
    };

    loadSettings();
    loadProfile();

    // i18n — init lang button and apply translations
    if (els.langToggle) {
      els.langToggle.textContent = t('lang.alt');
      els.langToggle.addEventListener('click', toggleLang);
    }

    // Category chips
    renderCategoryChips();

    // data-i18n attributes on static elements (settings panel etc.)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // Settings events
    els.settingsBtn.addEventListener('click', openSettings);
    els.settingsClose.addEventListener('click', closeSettings);
    els.settingsOverlay.addEventListener('click', e => {
      if (e.target === els.settingsOverlay) closeSettings();
    });
    els.settingsSave.addEventListener('click', saveSettings);
    els.settingsReset.addEventListener('click', resetSettings);

    // Profile events
    els.profileBtn.addEventListener('click', openProfile);
    els.profileClose.addEventListener('click', closeProfile);
    els.profileOverlay.addEventListener('click', e => {
      if (e.target === els.profileOverlay) closeProfile();
    });
    els.profileSave.addEventListener('click', saveProfile);
    els.profileReset.addEventListener('click', resetProfile);

    els.searchForm.addEventListener('submit', handleSearch);
    els.searchInput.value = 'Python engineer';
    handleSearch();
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', JSA.init);
} else {
  JSA.init();
}
