/* ============================================================
   JSA — Job Search Agent frontend application logic.
   Manages search, results display, modal detail view,
   and mock API interaction.
   ============================================================ */

const JSA = (() => {
  'use strict';

  // ---- State -------------------------------------------------
  const state = {
    jobs: [],
    loading: false,
    error: null,
    selectedJob: null,
  };

  // ---- DOM refs (populated on init) --------------------------
  let els = {};

  // ---- SVG score ring builder --------------------------------
  function buildScoreRing(score, size = 48) {
    const r = (size / 2) - 6;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
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

  // ---- Mock API (simulates Tavily search) --------------------
  const MOCK_JOBS = [
    {
      id: 'job-001', title: 'Senior Python Engineer', company: 'Acme Corp',
      location: 'San Francisco, CA', salary: '$150k – $200k', remote: true,
      url: 'https://example.com/jobs/001', post_date: '2026-07-20',
      description: 'Build and scale Python microservices powering Acme\'s AI platform. 5+ years of experience with FastAPI, SQLAlchemy, and AWS. You will own critical backend services serving 10M+ requests/day.',
      snippet: 'Build and scale Python microservices powering Acme\'s AI platform.',
      match_score: 88, missing_skills: ['Kubernetes'],
    },
    {
      id: 'job-002', title: 'ML Platform Engineer', company: 'DeepStart AI',
      location: 'Remote', salary: '$180k – $250k', remote: true,
      url: 'https://example.com/jobs/002', post_date: '2026-07-22',
      description: 'Design and operate the ML training and inference platform at DeepStart AI. Experience with PyTorch, Kubeflow, Kubernetes, and MLOps practices required.',
      snippet: 'Design and operate the ML training and inference platform.',
      match_score: 76, missing_skills: ['Kubeflow', 'PyTorch'],
    },
    {
      id: 'job-003', title: 'Backend Developer — Platform', company: 'WebScale Inc',
      location: 'New York, NY (Hybrid)', salary: '$120k – $160k', remote: false,
      url: 'https://example.com/jobs/003', post_date: '2026-07-18',
      description: 'Join the platform team building the next generation of WebScale\'s e-commerce infrastructure. Working on distributed systems, PostgreSQL at scale, and real-time data pipelines.',
      snippet: 'Join the platform team building the next generation of e-commerce infrastructure.',
      match_score: 65, missing_skills: ['PostgreSQL', 'Redis'],
    },
    {
      id: 'job-004', title: 'Data Engineer', company: 'AnalyticsPro',
      location: 'Austin, TX', salary: '$130k – $170k', remote: false,
      url: 'https://example.com/jobs/004', post_date: '2026-07-15',
      description: 'Build and maintain ETL pipelines powering AnalyticsPro\'s real-time dashboard products. Stack: Spark, Airflow, dbt, Snowflake. Strong SQL skills required.',
      snippet: 'Build and maintain ETL pipelines powering real-time dashboard products.',
      match_score: 55, missing_skills: ['Spark', 'Airflow', 'dbt'],
    },
    {
      id: 'job-005', title: 'DevOps / Infrastructure Engineer', company: 'CloudNative Ltd',
      location: 'Remote', salary: '$140k – $190k', remote: true,
      url: 'https://example.com/jobs/005', post_date: '2026-07-23',
      description: 'Own the cloud infrastructure at CloudNative. Terraform, AWS/GCP, GitHub Actions, Docker, and Kubernetes. You will design the multi-region deployment strategy.',
      snippet: 'Own the cloud infrastructure at CloudNative. Terraform, AWS/GCP, CI/CD.',
      match_score: 82, missing_skills: ['Terraform'],
    },
    {
      id: 'job-006', title: 'Software Engineer — Full Stack', company: 'GrowthPad',
      location: 'San Francisco, CA', salary: '$135k – $175k', remote: false,
      url: 'https://example.com/jobs/006', post_date: '2026-07-21',
      description: 'Full-stack engineer for GrowthPad\'s B2B SaaS platform. React frontend, Python/Django backend, and everything in between. Ideal for someone who enjoys product iteration.',
      snippet: 'Full-stack engineer for GrowthPad\'s B2B SaaS platform.',
      match_score: 71, missing_skills: ['Django', 'React'],
    },
  ];

  // ---- Simulate network delay --------------------------------
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---- Search function ---------------------------------------
  async function searchJobs(query, location, remoteOnly) {
    await delay(800 + Math.random() * 600);
    let results = [...MOCK_JOBS];

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    }
    if (location) {
      const loc = location.toLowerCase();
      results = results.filter(j => j.location.toLowerCase().includes(loc));
    }
    if (remoteOnly) {
      results = results.filter(j => j.remote);
    }
    return results;
  }

  // ---- Render helpers ----------------------------------------

  function renderResults() {
    const { jobs, loading, error } = state;
    els.results.innerHTML = '';

    if (loading) {
      els.results.innerHTML = `
        <div class="results-loading">
          <div class="spinner"></div>
          <p>Searching for matching positions...</p>
        </div>`;
      return;
    }

    if (error) {
      els.results.innerHTML = `
        <div class="results-error"><p>⚠️ ${escapeHtml(error)}</p></div>`;
      return;
    }

    if (jobs.length === 0) {
      els.results.innerHTML = `
        <div class="results-empty">
          <div class="empty-icon">🔍</div>
          <h3>No jobs found</h3>
          <p>Try adjusting your search keywords or location to find more opportunities.</p>
        </div>`;
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
          ${job.remote ? '<span class="tag remote">🌍 Remote</span>' : ''}
        </div>
        <div class="job-card-snippet">${escapeHtml(job.snippet)}</div>
        <div class="job-card-footer">
          <span class="job-card-date">Posted ${job.post_date}</span>
          <button class="job-card-btn" aria-label="View details">View →</button>
        </div>`;
      grid.appendChild(card);
    });

    els.results.appendChild(grid);
  }

  function openDetail(job) {
    state.selectedJob = job;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDetail(); });

    const scoreCls = job.match_score >= 80 ? 'high' : job.match_score >= 60 ? 'medium' : 'low';
    const missingBadges = (job.missing_skills || []).map(s =>
      `<span class="tag">${escapeHtml(s)}</span>`
    ).join('');

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Job details">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(job.title)}</h2>
            <div class="company">${escapeHtml(job.company)}</div>
          </div>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
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
            <button class="btn btn-secondary">📝 Generate Cover Letter</button>
            <button class="btn btn-secondary">💾 Save to Tracker</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Wire modal close
    overlay.querySelector('.modal-close').addEventListener('click', closeDetail);
    document.addEventListener('keydown', _onEsc);

    // Wire Open Posting
    overlay.querySelector('.open-url').addEventListener('click', () => {
      window.open(job.url, '_blank', 'noopener');
    });

    // Trap focus
    overlay.querySelector('button')?.focus();
  }

  function closeDetail() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _onEsc);
    state.selectedJob = null;
  }

  function _onEsc(e) { if (e.key === 'Escape') closeDetail(); }

  // ---- Utility -----------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Main search handler -----------------------------------
  async function handleSearch(e) {
    if (e) e.preventDefault();
    const query = els.searchInput.value.trim();
    const location = els.locationInput.value.trim();
    const remoteOnly = els.remoteToggle.checked;

    if (!query) {
      els.searchInput.focus();
      return;
    }

    state.loading = true;
    state.error = null;
    renderResults();

    try {
      const results = await searchJobs(query, location, remoteOnly);
      state.jobs = results;
      if (results.length === 0) {
        // no-op — empty state renders automatically
      }
    } catch (err) {
      state.error = err.message || 'Search failed. Please try again.';
    } finally {
      state.loading = false;
      renderResults();
    }
  }

  // ---- Init --------------------------------------------------
  function init() {
    els = {
      searchForm:    document.getElementById('searchForm'),
      searchInput:   document.getElementById('searchInput'),
      locationInput: document.getElementById('locationInput'),
      remoteToggle:  document.getElementById('remoteToggle'),
      results:       document.getElementById('results'),
      resultsCount:  document.getElementById('resultsCount'),
      resultsHeader: document.getElementById('resultsHeader'),
    };

    els.searchForm.addEventListener('submit', handleSearch);

    // Auto-run initial search with default query
    els.searchInput.value = 'Python engineer';
    handleSearch();
  }

  return { init };
})();

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', JSA.init);
} else {
  JSA.init();
}
