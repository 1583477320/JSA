/* ============================================================
   JSA — Job Search Agent frontend application logic.
   Manages search, results display, modal detail with chat,
   and settings persistence via localStorage.
   ============================================================ */

const JSA = (() => {
  'use strict';

  // ================================================================
  //  State
  // ================================================================
  const state = {
    jobs: [],
    loading: false,
    error: null,
    selectedJob: null,
    chatMessages: [],          // { role, content }[]
    chatHistory: {},           // jobId -> messages[]
    settings: {},
    activeTab: 'overview',
  };

  let els = {};

  // ================================================================
  //  Settings — localStorage persistence
  // ================================================================
  const SETTINGS_KEY = 'jsa_settings';
  const DEFAULT_SETTINGS = {
    openaiApiKey: '',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',
    tavilyApiKey: '',
    anthropicApiKey: '',
    maxResults: 10,
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      state.settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      state.settings = { ...DEFAULT_SETTINGS };
    }
    return state.settings;
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
    _showSettingsStatus('✅ Settings saved', 'ok');
  }

  function resetSettings() {
    state.settings = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(SETTINGS_KEY);
    _populateSettingsForm();
    _showSettingsStatus('↺ Reset to defaults', 'ok');
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

  // ================================================================
  //  Settings panel open/close
  // ================================================================
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
  //  SVG score ring builder
  // ================================================================
  function buildScoreRing(score, size = 48) {
    const r = (size / 2) - 6;
    const circ = 2 * Math.PI * r;
    const offset = circ - Math.min(score, 100) / 100 * circ;
    const cls = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
    return `
      <svg viewBox="0 0 ${size} ${size}" aria-label="Match score ${score}%">
        <circle class="bg"  cx="${size/2}" cy="${size/2}" r="${r}"/>
        <circle class="fg ${cls}" cx="${size/2}" cy="${size/2}" r="${r}"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
                style="transition: stroke-dashoffset 0.6s cubic-bezier(.22,1,.36,1)"/>
        <text x="${size/2}" y="${size/2}" class="${cls}">${score}%</text>
      </svg>`;
  }

  // ================================================================
  //  Mock data
  // ================================================================
  const MOCK_JOBS = [
    { id: 'job-001', title: 'Senior Python Engineer', company: 'Acme Corp',
      location: 'San Francisco, CA', salary: '$150k – $200k', remote: true,
      url: 'https://example.com/jobs/001', post_date: '2026-07-20',
      description: 'Build and scale Python microservices powering Acme\'s AI platform. 5+ years of experience with FastAPI, SQLAlchemy, and AWS. You will own critical backend services serving 10M+ requests/day.',
      snippet: 'Build and scale Python microservices powering Acme\'s AI platform.',
      match_score: 88, missing_skills: ['Kubernetes'] },
    { id: 'job-002', title: 'ML Platform Engineer', company: 'DeepStart AI',
      location: 'Remote', salary: '$180k – $250k', remote: true,
      url: 'https://example.com/jobs/002', post_date: '2026-07-22',
      description: 'Design and operate the ML training and inference platform at DeepStart AI. Experience with PyTorch, Kubeflow, Kubernetes, and MLOps practices required.',
      snippet: 'Design and operate the ML training and inference platform.',
      match_score: 76, missing_skills: ['Kubeflow', 'PyTorch'] },
    { id: 'job-003', title: 'Backend Developer — Platform', company: 'WebScale Inc',
      location: 'New York, NY (Hybrid)', salary: '$120k – $160k', remote: false,
      url: 'https://example.com/jobs/003', post_date: '2026-07-18',
      description: 'Join the platform team building the next generation of WebScale\'s e-commerce infrastructure. Working on distributed systems, PostgreSQL at scale, and real-time data pipelines.',
      snippet: 'Join the platform team building next-gen e-commerce infrastructure.',
      match_score: 65, missing_skills: ['PostgreSQL', 'Redis'] },
    { id: 'job-004', title: 'Data Engineer', company: 'AnalyticsPro',
      location: 'Austin, TX', salary: '$130k – $170k', remote: false,
      url: 'https://example.com/jobs/004', post_date: '2026-07-15',
      description: 'Build and maintain ETL pipelines powering AnalyticsPro\'s real-time dashboard products. Stack: Spark, Airflow, dbt, Snowflake. Strong SQL skills required.',
      snippet: 'Build and maintain ETL pipelines powering real-time dashboards.',
      match_score: 55, missing_skills: ['Spark', 'Airflow', 'dbt'] },
    { id: 'job-005', title: 'DevOps / Infrastructure Engineer', company: 'CloudNative Ltd',
      location: 'Remote', salary: '$140k – $190k', remote: true,
      url: 'https://example.com/jobs/005', post_date: '2026-07-23',
      description: 'Own the cloud infrastructure at CloudNative. Terraform, AWS/GCP, GitHub Actions, Docker, and Kubernetes. You will design the multi-region deployment strategy.',
      snippet: 'Own the cloud infrastructure at CloudNative. Terraform, AWS/GCP, CI/CD.',
      match_score: 82, missing_skills: ['Terraform'] },
    { id: 'job-006', title: 'Software Engineer — Full Stack', company: 'GrowthPad',
      location: 'San Francisco, CA', salary: '$135k – $175k', remote: false,
      url: 'https://example.com/jobs/006', post_date: '2026-07-21',
      description: 'Full-stack engineer for GrowthPad\'s B2B SaaS platform. React frontend, Python/Django backend, and everything in between.',
      snippet: 'Full-stack engineer for GrowthPad\'s B2B SaaS platform.',
      match_score: 71, missing_skills: ['Django', 'React'] },
  ];

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function searchJobs(query, location, remoteOnly) {
    await delay(600 + Math.random() * 400);
    let results = [...MOCK_JOBS];
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q));
    }
    if (location) {
      const l = location.toLowerCase();
      results = results.filter(j => j.location.toLowerCase().includes(l));
    }
    if (remoteOnly) results = results.filter(j => j.remote);
    return results;
  }

  // ================================================================
  //  Chat engine — contextual mock AI responses
  // ================================================================
  const _chatContexts = {
    'job-001': {
      tone: 'You are a senior backend engineer mentor.',
      facts: ['Python', 'FastAPI', 'SQLAlchemy', 'AWS', 'microservices', '10M requests/day'],
    },
    'job-002': {
      tone: 'You are an ML platform architect with deep MLOps experience.',
      facts: ['PyTorch', 'Kubeflow', 'Kubernetes', 'MLOps', 'training pipelines'],
    },
    'job-003': {
      tone: 'You are a distributed systems expert.',
      facts: ['PostgreSQL', 'Redis', 'e-commerce', 'real-time pipelines', 'distributed systems'],
    },
    'job-004': {
      tone: 'You are a senior data engineer.',
      facts: ['Spark', 'Airflow', 'dbt', 'Snowflake', 'ETL', 'real-time dashboards'],
    },
    'job-005': {
      tone: 'You are a cloud infrastructure lead.',
      facts: ['Terraform', 'AWS', 'GCP', 'GitHub Actions', 'Docker', 'Kubernetes', 'multi-region'],
    },
    'job-006': {
      tone: 'You are a full-stack tech lead.',
      facts: ['React', 'Python', 'Django', 'B2B SaaS', 'full-stack'],
    },
  };

  const _genericResponses = [
    "Based on the job description, the key technologies they're looking for include **{tech}**. Your background aligns well with most of these requirements.",
    "A good approach here is to highlight your experience with **{tech}** in your resume. Even if you don't meet 100% of the requirements, your transferable skills are valuable.",
    "For this role at **{company}**, I'd recommend emphasizing your work on projects that involved scalable systems and team collaboration.",
    "Looking at the match score (**{score}%**), this is a {strength} fit. {advice}",
    "The missing skills are: {missing}. To bridge this gap, you could mention any related experience or side projects that demonstrate fast learning.",
  ];

  function _getChatContext(job) {
    return _chatContexts[job.id] || {
      tone: 'You are a career coach specialized in tech roles.',
      facts: ['software engineering', 'technology', 'career development'],
    };
  }

  function _generateChatReply(job, userMsg) {
    const ctx = _getChatContext(job);
    const tech = ctx.facts[Math.floor(Math.random() * ctx.facts.length)];
    const missing = job.missing_skills?.join(', ') || 'none identified';
    const strength = job.match_score >= 80 ? 'strong' : job.match_score >= 60 ? 'moderate' : 'longer-shot';
    const advice = job.match_score >= 80
      ? 'You should definitely apply! Focus on your relevant experience in the cover letter.'
      : job.match_score >= 60
        ? 'Consider upskilling in the missing areas while applying. Your core experience is relevant.'
        : 'This might be a stretch, but if you\'re passionate about the domain, go for it — focus on transferable skills.';

    // Check for keywords in user message
    const lower = userMsg.toLowerCase();

    if (lower.includes('salary') || lower.includes('pay') || lower.includes('compensation')) {
      return `The listed salary range is **${job.salary}**. This is ${job.match_score >= 70 ? 'competitive' : 'average'} for this type of role in ${job.location}. When negotiating, focus on total compensation (base + equity + benefits).`;
    }
    if (lower.includes('interview') || lower.includes('prepare') || lower.includes('tips')) {
      return `Great question! For this ${job.title} role at ${job.company}, I'd suggest:\n\n1. **Technical prep**: Focus on ${tech} — expect system design questions around scalability.\n2. **Behavioral**: Prepare stories about cross-team collaboration and project ownership.\n3. **Company research**: Understand ${job.company}'s products and how this role impacts their roadmap.\n\nWant me to generate specific practice questions?`;
    }
    if (lower.includes('cover') || lower.includes('letter')) {
      return `For the cover letter, I'd structure it as:\n\n1. **Opening**: Express enthusiasm for ${job.company} and their ${job.description.split('.')[0].toLowerCase()}.\n2. **Technical fit**: Highlight your experience with ${tech} and how it maps to their needs.\n3. **Bridge**: ${missing ? `Acknowledge that while you're building depth in ${missing}, your core engineering skills are directly applicable.` : 'Directly address how your background matches their requirements.'}\n4. **Closing**: Reiterate interest and invite a conversation.\n\nWould you like me to draft one?`;
    }
    if (lower.includes('remote') || lower.includes('wfh') || lower.includes('onsite')) {
      return `This position is listed as **${job.remote ? '🌍 Remote' : '📍 On-site / Hybrid in ' + job.location}**. ${job.remote ? 'The company is remote-friendly, which gives you flexibility.' : 'You\'ll need to be based in or willing to relocate to ' + job.location + '.'}`;
    }
    if (lower.includes('match') || lower.includes('score') || lower.includes('fit')) {
      return `Your match score is **${job.match_score}%**. ${advice} The score is based on skills overlap, experience relevance, and location alignment. ${missing ? `\n\nAreas to improve: **${missing}**.` : ''}`;
    }

    // Default contextual response
    const templates = _genericResponses;
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    return tpl
      .replace('{tech}', tech)
      .replace('{company}', job.company)
      .replace('{score}', job.match_score)
      .replace('{strength}', strength)
      .replace('{advice}', advice)
      .replace('{missing}', missing);
  }

  function sendChatMessage(job) {
    const input = els.chatInput;
    const text = input.value.trim();
    if (!text) return;

    // Add user message
    state.chatMessages.push({ role: 'user', content: text });
    _renderChatMessages(job);
    input.value = '';
    els.chatSend.disabled = true;

    // Show typing indicator
    const container = els.chatMessages;
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg typing';
    typingEl.id = 'chatTyping';
    typingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    container.appendChild(typingEl);
    container.scrollTop = container.scrollHeight;

    // Simulate AI response delay
    setTimeout(() => {
      const reply = _generateChatReply(job, text);
      state.chatMessages.push({ role: 'assistant', content: reply });
      // Remove typing indicator
      const t = document.getElementById('chatTyping');
      if (t) t.remove();
      _renderChatMessages(job);
      els.chatSend.disabled = false;
      els.chatInput.focus();
    }, 800 + Math.random() * 700);
  }

  function _renderChatMessages(job) {
    const container = els.chatMessages;
    // Keep typing indicator if present
    const typing = document.getElementById('chatTyping');

    // Clear messages but keep the context bar
    const contextBar = container.parentElement.querySelector('.chat-context');
    container.innerHTML = '';
    if (contextBar) container.parentElement.insertBefore(contextBar, container);

    // Render messages
    state.chatMessages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `chat-msg ${msg.role}`;
      div.innerHTML = msg.role === 'assistant'
        ? `<div class="msg-label">JSA</div>${_md(msg.content)}`
        : _md(msg.content);
      container.appendChild(div);
    });

    // Restore typing indicator
    if (typing) container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  // Minimal markdown-ish renderer (bold, italic, newlines)
  function _md(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // ================================================================
  //  Render results + detail modal
  // ================================================================
  function renderResults() {
    const { jobs, loading, error } = state;
    els.results.innerHTML = '';

    if (loading) {
      els.results.innerHTML = '<div class="results-loading"><div class="spinner"></div><p>Searching for matching positions...</p></div>';
      return;
    }
    if (error) {
      els.results.innerHTML = `<div class="results-error"><p>⚠️ ${escapeHtml(error)}</p></div>`;
      return;
    }
    if (jobs.length === 0) {
      els.results.innerHTML = '<div class="results-empty"><div class="empty-icon">🔍</div><h3>No jobs found</h3><p>Try adjusting your search keywords or location to find more opportunities.</p></div>';
      return;
    }

    els.resultsCount.textContent = `${jobs.length} position${jobs.length > 1 ? 's' : ''} found`;
    const grid = document.createElement('div');
    grid.className = 'job-grid';

    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `View details for ${job.title} at ${job.company}`);
      card.addEventListener('click', () => openDetail(job));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(job); });

      card.innerHTML = `
        <div class="job-card-top">
          <div>
            <div class="job-card-company">${escapeHtml(job.company)}</div>
            <div class="job-card-title">${escapeHtml(job.title)}</div>
          </div>
          <div class="score-ring" title="Match score: ${job.match_score}%">${buildScoreRing(job.match_score)}</div>
        </div>
        <div class="job-card-tags">
          <span class="tag location">📍 ${escapeHtml(job.location)}</span>
          <span class="tag salary">💰 ${escapeHtml(job.salary)}</span>
          ${job.remote ? '<span class="tag">🌍 Remote</span>' : ''}
        </div>
        <div class="job-card-snippet">${escapeHtml(job.snippet)}</div>
        <div class="job-card-footer">
          <span class="job-card-date">Posted ${job.post_date}</span>
          <button class="job-card-btn">View →</button>
        </div>`;
      grid.appendChild(card);
    });
    els.results.appendChild(grid);
  }

  function openDetail(job) {
    state.selectedJob = job;
    // Restore chat history for this job
    state.chatMessages = state.chatHistory[job.id] || [
      { role: 'assistant', content: `👋 I've analyzed the **${job.title}** role at **${job.company}**. Feel free to ask me anything — salary, interview tips, cover letter advice, or how well you match!` },
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

        <!-- Tabs -->
        <div class="modal-tabs" role="tablist">
          <button class="modal-tab active" data-tab="overview" role="tab">📋 Overview</button>
          <button class="modal-tab" data-tab="chat" role="tab">💬 Chat <span class="navbar-badge" style="font-size:.65rem">Ask AI</span></button>
        </div>

        <!-- Overview panel -->
        <div class="modal-panel active" id="panelOverview" role="tabpanel">
          <div class="modal-body">
            <div class="modal-match">
              <div class="score-ring">${buildScoreRing(job.match_score, 64)}</div>
              <div class="match-details">
                <h4>Match Score: <span class="${scoreCls}">${job.match_score}%</span></h4>
                <p>Based on skills overlap, experience relevance, and location alignment</p>
              </div>
            </div>
            <h3>Description</h3>
            <div class="desc-text">${escapeHtml(job.description)}</div>
            <h3>Details</h3>
            <p>📍 ${escapeHtml(job.location)} &nbsp;·&nbsp; 💰 ${escapeHtml(job.salary)}</p>
            ${missingBadges ? `<h3>Missing Skills</h3><div class="missing-skills">${missingBadges}</div>` : ''}
            <div class="modal-actions">
              <button class="btn btn-primary open-url">🔗 Open Posting</button>
              <button class="btn btn-secondary" id="chatFromOverview">💬 Ask AI About This Job</button>
              <button class="btn btn-secondary">💾 Save to Tracker</button>
            </div>
          </div>
        </div>

        <!-- Chat panel -->
        <div class="modal-panel" id="panelChat" role="tabpanel">
          <div class="modal-body">
            <div class="chat-context">
              <span>💼</span> Chatting about <strong>${escapeHtml(job.title)}</strong> at <strong>${escapeHtml(job.company)}</strong>
            </div>
            <div class="chat-container">
              <div class="chat-messages"></div>
              <div class="chat-input-area">
                <input type="text" placeholder="Ask about salary, interview tips, skills..." autocomplete="off">
                <button class="chat-send" aria-label="Send">➤</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.modal');

    // Close
    modal.querySelector('.modal-close').addEventListener('click', closeDetail);
    document.addEventListener('keydown', _onEsc);

    // Open Posting
    modal.querySelector('.open-url')?.addEventListener('click', () => {
      window.open(job.url, '_blank', 'noopener');
    });

    // Tab switching
    modal.querySelectorAll('.modal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
        const panel = modal.querySelector(`#panel${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`);
        if (panel) panel.classList.add('active');
        state.activeTab = btn.dataset.tab;
        if (btn.dataset.tab === 'chat') {
          _initChat(job, modal);
        }
      });
    });

    // Chat from overview button
    modal.querySelector('#chatFromOverview')?.addEventListener('click', () => {
      modal.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
      modal.querySelector('[data-tab="chat"]')?.classList.add('active');
      modal.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
      const panel = modal.querySelector('#panelChat');
      if (panel) panel.classList.add('active');
      state.activeTab = 'chat';
      _initChat(job, modal);
    });

    // Trap focus
    setTimeout(() => modal.querySelector('.modal-close')?.focus(), 100);
  }

  function _initChat(job, modal) {
    const container = modal.querySelector('.chat-messages');
    const input = modal.querySelector('.chat-input-area input');
    const sendBtn = modal.querySelector('.chat-send');

    // Store DOM refs for chat
    els.chatMessages = container;
    els.chatInput = input;
    els.chatSend = sendBtn;

    // Render existing messages
    state.chatMessages = state.chatHistory[job.id] || state.chatMessages;
    state.chatHistory[job.id] = state.chatMessages;
    _renderChatMessages(job);

    // Remove old listeners by cloning
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

  // ================================================================
  //  Search handler
  // ================================================================
  async function handleSearch(e) {
    if (e) e.preventDefault();
    const query = els.searchInput.value.trim();
    const location = els.locationInput.value.trim();
    const remoteOnly = els.remoteToggle.checked;
    if (!query) { els.searchInput.focus(); return; }

    state.loading = true; state.error = null;
    renderResults();
    try {
      state.jobs = await searchJobs(query, location, remoteOnly);
    } catch (err) {
      state.error = err.message || 'Search failed.';
    } finally {
      state.loading = false;
      renderResults();
    }
  }

  // ================================================================
  //  Init
  // ================================================================
  function init() {
    els = {
      searchForm:      document.getElementById('searchForm'),
      searchInput:     document.getElementById('searchInput'),
      locationInput:   document.getElementById('locationInput'),
      remoteToggle:    document.getElementById('remoteToggle'),
      results:         document.getElementById('results'),
      resultsCount:    document.getElementById('resultsCount'),
      resultsHeader:   document.getElementById('resultsHeader'),
      // Settings
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
    };

    // Load settings
    loadSettings();

    // Settings events
    els.settingsBtn.addEventListener('click', openSettings);
    els.settingsClose.addEventListener('click', closeSettings);
    els.settingsOverlay.addEventListener('click', e => {
      if (e.target === els.settingsOverlay) closeSettings();
    });
    els.settingsSave.addEventListener('click', saveSettings);
    els.settingsReset.addEventListener('click', resetSettings);

    // Search
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
