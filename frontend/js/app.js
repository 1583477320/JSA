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
    activeTab: 'overview',
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
    const resp = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query || '',
        location: location || '',
        remoteOnly: !!remoteOnly,
        maxResults: state.settings.maxResults || 10,
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

  function _generateChatReply(job, userMsg) {
    const ctx = _getChatContext(job);
    const isZh = state.lang === 'zh';
    const facts = isZh ? ctx.factsZh : ctx.factsEn;
    const tech = facts[Math.floor(Math.random() * facts.length)];
    const missing = job.missing_skills?.join(', ') || (isZh ? '无' : 'none');
    const strength = isZh
      ? (job.match_score >= 80 ? '很强' : job.match_score >= 60 ? '中等' : '偏低')
      : (job.match_score >= 80 ? 'strong' : job.match_score >= 60 ? 'moderate' : 'longer-shot');
    const advice = isZh
      ? (job.match_score >= 80 ? '强烈建议投递！在求职信中突出你的相关经验即可。'
        : job.match_score >= 60 ? '建议在投递的同时补充缺失技能。你的核心经验是相关的。'
        : '可能有些挑战，但如果你对这个领域有热情，可以一试——重点强调可迁移能力。')
      : (job.match_score >= 80 ? 'You should definitely apply! Focus on your relevant experience in the cover letter.'
        : job.match_score >= 60 ? 'Consider upskilling in the missing areas while applying. Your core experience is relevant.'
        : 'This might be a stretch, but if you\'re passionate about the domain, go for it — focus on transferable skills.');

    const lower = userMsg.toLowerCase();

    // Salary
    if (lower.includes('salary') || lower.includes('pay') || lower.includes('comp') || lower.includes('薪资') || lower.includes('工资') || lower.includes('待遇')) {
      return isZh
        ? `该岗位的薪资范围为 **${job.salary}**。在 ${job.location} 地区，这属于${job.match_score >= 70 ? '有竞争力' : '中等水平'}的水平。谈判时建议关注整体薪酬（base + 期权 + 福利）。`
        : `The listed salary range is **${job.salary}**. This is ${job.match_score >= 70 ? 'competitive' : 'average'} for this type of role in ${job.location}. When negotiating, focus on total compensation (base + equity + benefits).`;
    }
    // Interview
    if (lower.includes('interview') || lower.includes('prepare') || lower.includes('tips') || lower.includes('面试') || lower.includes('准备') || lower.includes('技巧')) {
      return isZh
        ? `好问题！对于 ${job.company} 的 ${job.title} 岗位，我建议：\n\n1. **技术准备**：重点掌握 ${tech}——可能需要系统设计相关的问题。\n2. **行为面试**：准备跨团队协作和项目主导的故事。\n3. **公司研究**：了解 ${job.company} 的产品以及该岗位对其路线图的影响。\n\n需要我生成具体的练习问题吗？`
        : `Great question! For this ${job.title} role at ${job.company}, I'd suggest:\n\n1. **Technical prep**: Focus on ${tech} — expect system design questions around scalability.\n2. **Behavioral**: Prepare stories about cross-team collaboration and project ownership.\n3. **Company research**: Understand ${job.company}'s products and how this role impacts their roadmap.\n\nWant me to generate specific practice questions?`;
    }
    // Cover letter
    if (lower.includes('cover') || lower.includes('letter') || lower.includes('求职信')) {
      return isZh
        ? `关于求职信，我建议的结构是：\n\n1. **开头**：表达对 ${job.company} 及其 ${job.description.split('.')[0]} 的热情。\n2. **技术匹配**：强调你在 ${tech} 方面的经验如何满足他们的需求。\n3. **桥梁段落**：${missing !== '无' ? `虽然我在 ${missing} 方面的深度还在建设中，但我的核心工程技能可以直接应用。` : '直接说明你的背景如何完美匹配他们的要求。'}\n4. **结尾**：再次表达兴趣并邀请进一步沟通。\n\n需要我起草一封吗？`
        : `For the cover letter, I'd structure it as:\n\n1. **Opening**: Express enthusiasm for ${job.company} and their ${job.description.split('.')[0].toLowerCase()}.\n2. **Technical fit**: Highlight your experience with ${tech} and how it maps to their needs.\n3. **Bridge**: ${missing !== 'none' ? `Acknowledge that while you're building depth in ${missing}, your core engineering skills are directly applicable.` : 'Directly address how your background matches their requirements.'}\n4. **Closing**: Reiterate interest and invite a conversation.\n\nWould you like me to draft one?`;
    }
    // Remote
    if (lower.includes('remote') || lower.includes('wfh') || lower.includes('onsite') || lower.includes('远程') || lower.includes('在家') || lower.includes(' onsite')) {
      return isZh
        ? `该岗位标注为 **${job.remote ? '🌍 远程' : '📍 现场/混合办公，地点：' + job.location}**。${job.remote ? '该公司支持远程办公，给你更大的灵活性。' : '你需要基于或愿意搬迁到 ' + job.location + '。'}`
        : `This position is listed as **${job.remote ? '🌍 Remote' : '📍 On-site / Hybrid in ' + job.location}**. ${job.remote ? 'The company is remote-friendly, which gives you flexibility.' : 'You\'ll need to be based in or willing to relocate to ' + job.location + '.'}`;
    }
    // Match score
    if (lower.includes('match') || lower.includes('score') || lower.includes('fit') || lower.includes('匹配') || lower.includes('分数')) {
      return isZh
        ? `你的匹配分数为 **${job.match_score}%**。${advice} 分数基于技能重合度、经验相关性和地点匹配度计算。${missing !== '无' ? `\n\n建议提升的领域：**${missing}**。` : ''}`
        : `Your match score is **${job.match_score}%**. ${advice} The score is based on skills overlap, experience relevance, and location alignment.${missing !== 'none' ? `\n\nAreas to improve: **${missing}**.` : ''}`;
    }

    // Default
    if (isZh) {
      const zhTemplates = [
        `根据职位描述，他们正在寻找的关键技术包括 **${tech}**。你的背景与大部分要求匹配得很好。`,
        `一个好的方法是在简历中突出你在 **${tech}** 方面的经验。即使不完全满足所有要求，你的可迁移技能也很有价值。`,
        `对于 **${job.company}** 的这个岗位，我建议强调你在可扩展系统和团队协作方面的工作。`,
        `从匹配分数（**${job.match_score}%**）来看，这是一个${strength}的匹配。${advice}`,
        `缺失技能：${missing}。要弥合这一差距，你可以提及任何相关的经验或展示快速学习能力的副项目。`,
      ];
      return zhTemplates[Math.floor(Math.random() * zhTemplates.length)];
    }
    const enTemplates = [
      `Based on the job description, the key technologies they're looking for include **${tech}**. Your background aligns well with most of these requirements.`,
      `A good approach here is to highlight your experience with **${tech}** in your resume. Even if you don't meet 100% of the requirements, your transferable skills are valuable.`,
      `For this role at **${job.company}**, I'd recommend emphasizing your work on projects that involved scalable systems and team collaboration.`,
      `Looking at the match score (**${job.match_score}%**), this is a ${strength} fit. ${advice}`,
      `The missing skills are: ${missing}. To bridge this gap, you could mention any related experience or side projects that demonstrate fast learning.`,
    ];
    return enTemplates[Math.floor(Math.random() * enTemplates.length)];
  }

  function sendChatMessage(job) {
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

    setTimeout(() => {
      const reply = _generateChatReply(job, text);
      state.chatMessages.push({ role: 'assistant', content: reply });
      const tEl = document.getElementById('chatTyping');
      if (tEl) tEl.remove();
      _renderChatMessages(job);
      els.chatSend.disabled = false;
      els.chatInput.focus();
    }, 800 + Math.random() * 700);
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
    const { jobs, loading, error } = state;
    els.results.innerHTML = '';

    if (loading) {
      els.results.innerHTML = `<div class="results-loading"><div class="spinner"></div><p>${t('results.loading')}</p></div>`;
      return;
    }
    if (error) {
      els.results.innerHTML = `<div class="results-error"><p>⚠️ ${escapeHtml(error)}</p></div>`;
      return;
    }
    if (jobs.length === 0) {
      els.results.innerHTML = `<div class="results-empty"><div class="empty-icon">🔍</div><h3>${t('results.empty.title')}</h3><p>${t('results.empty.desc')}</p></div>`;
      return;
    }

    els.resultsCount.textContent = t('results.count', { n: jobs.length, s: jobs.length > 1 ? 's' : '' });
    const grid = document.createElement('div');
    grid.className = 'job-grid';

    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${job.title} at ${job.company}`);
      card.addEventListener('click', () => openDetail(job));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(job); });

      const postedLabel = t('card.posted');
      const viewLabel = t('card.view');
      const remoteLabel = t('card.remote');
      card.innerHTML = `
        <div class="job-card-top">
          <div>
            <div class="job-card-company">${escapeHtml(job.company)}</div>
            <div class="job-card-title">${escapeHtml(job.title)}</div>
          </div>
          <div class="score-ring" title="${t('card.match')}: ${job.match_score}%">${buildScoreRing(job.match_score)}</div>
        </div>
        <div class="job-card-tags">
          <span class="tag location">📍 ${escapeHtml(job.location)}</span>
          <span class="tag salary">💰 ${escapeHtml(job.salary)}</span>
          ${job.remote ? `<span class="tag">🌍 ${remoteLabel}</span>` : ''}
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
            <div class="desc-text">${escapeHtml(job.description)}</div>
            <h3>${t('detail.section.details')}</h3>
            <p>📍 ${escapeHtml(job.location)} &nbsp;·&nbsp; 💰 ${escapeHtml(job.salary)}</p>
            ${missingBadges ? `<h3>${t('detail.section.missing')}</h3><div class="missing-skills">${missingBadges}</div>` : ''}
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
    };

    loadSettings();

    // i18n — init lang button and apply translations
    if (els.langToggle) {
      els.langToggle.textContent = t('lang.alt');
      els.langToggle.addEventListener('click', toggleLang);
    }

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
