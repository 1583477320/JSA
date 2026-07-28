/** Vercel Node.js Serverless Function — Tavily search proxy.
 *
 *  Frontend Settings → POST /api/search → Tavily API → JSON results.
 *  API key 优先来自请求体（前端 Settings 面板），其次 Vercel 环境变量。
 */

const TAVILY_URL = 'https://api.tavily.com/search';

function json(res, status, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, {});

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const query         = (body.query || '').trim();
  const location      = (body.location || '').trim();
  const remoteOnly    = !!body.remoteOnly;
  const maxResults    = Math.min(Math.max(parseInt(body.maxResults, 10) || 10, 1), 50);
  const apiKey        = (body.tavilyApiKey || '').trim() || process.env.VERCEL_TAVILY_KEY || '';
  const categories    = Array.isArray(body.categories) ? body.categories : [];

  if (!query) return json(res, 400, { error: 'query is required' });
  if (!apiKey) {
    return json(res, 400, {
      error: 'Tavily API Key 未配置 — 请在 Settings 中填写，或在 Vercel 环境变量中设置 VERCEL_TAVILY_KEY',
    });
  }

  // ---- Build query from categories ----------------------------
  let searchQ = query;
  if (remoteOnly) searchQ += ' remote';
  if (location) searchQ += ` ${location}`;

  // Platform targeting
  const PLATFORM_MAP = {
    'BOSS直聘': 'zhipin.com',
    '猎聘': 'liepin.com',
    '拉钩': 'lagou.com',
    '智联招聘': 'zhaopin.com',
    'LinkedIn': 'linkedin.com',
    'Indeed': 'indeed.com',
  };
  const selectedPlatforms = categories.filter((c) => PLATFORM_MAP[c]).map((c) => PLATFORM_MAP[c]);
  if (selectedPlatforms.length === 1) {
    searchQ += ` site:${selectedPlatforms[0]}`;
  } else if (selectedPlatforms.length > 1) {
    searchQ += ` (${selectedPlatforms.map((s) => `site:${s}`).join(' OR ')})`;
  }

  // Company-type targeting
  const BIG_TECH_NAMES = [
    'ByteDance', 'Tencent', 'Alibaba', 'Baidu', 'Meituan', 'JD.com',
    'Xiaomi', 'Huawei', 'NetEase', 'PDD', 'Pinduoduo', 'Kuaishou',
    'Bilibili', 'NIO', 'XPeng', 'Li Auto',
  ];
  const FOREIGN_NAMES = [
    'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix',
    'Uber', 'Shopify', 'Spotify', 'IBM', 'Oracle', 'SAP', 'Adobe',
    'Salesforce', 'Cisco', 'Intel', 'NVIDIA', 'AMD',
  ];

  if (categories.includes('大厂')) {
    searchQ += ` (${BIG_TECH_NAMES.slice(0, 8).join(' OR ')})`;
  }
  if (categories.includes('外企')) {
    searchQ += ` (${FOREIGN_NAMES.slice(0, 8).join(' OR ')})`;
  }

  try {
    const tavilyResp = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: searchQ,
        search_depth: 'advanced',
        include_raw_content: true,
        max_results: Math.min(maxResults, 20),
      }),
    });

    if (!tavilyResp.ok) {
      const errText = await tavilyResp.text().catch(() => '');
      return json(res, 502, { error: `Tavily API ${tavilyResp.status}: ${errText.slice(0, 200)}` });
    }

    const data = await tavilyResp.json();
    const jobs = (data.results || []).map((hit) => {
      const title = hit.title || '';
      const url = hit.url || '';
      const company = extractCompany(title, url);
      const rawContent = hit.raw_content || hit.content || '';
      const snippet = rawContent.slice(0, 2000);
      return {
        id: url || title,
        title,
        company,
        location: '',
        salary: '',
        url,
        post_date: '',
        snippet,
        raw_content: rawContent.slice(0, 5000),
        description: rawContent.slice(0, 5000),
        match_score: 0,
        missing_skills: [],
        categories: classifyJob(title, company, url, snippet),
      };
    });

    return json(res, 200, { jobs });
  } catch (err) {
    return json(res, 500, { error: `Search failed: ${err.message}` });
  }
}

// ---- Job classification ----------------------------------------
const BIG_TECH = [
  '字节跳动', 'bytedance', '腾讯', 'tencent', '阿里巴巴', 'alibaba', '蚂蚁', 'ant',
  '百度', 'baidu', '美团', 'meituan', '京东', 'jd.com', '小米', 'xiaomi',
  '华为', 'huawei', '网易', 'netease', '拼多多', 'pinduoduo', 'pdd',
  '快手', 'kuaishou', '滴滴', 'didiglobal', '小红书', 'xiaohongshu',
  'bilibili', 'b站', '蔚来', 'nio', '理想', 'li auto', '小鹏', 'xpeng',
];

const FOREIGN = [
  'google', 'microsoft', 'apple', 'amazon', 'aws', 'meta', 'facebook',
  'netflix', 'uber', 'airbnb', 'shopify', 'spotify', 'twitter', 'x',
  'ibm', 'oracle', 'sap', 'adobe', 'salesforce', 'cisco', 'intel', 'nvidia',
  'amd', 'zoom', 'notion', 'figma', 'datadog', 'cloudflare',
  'mongodb', 'snowflake', 'confluent', 'elastic', 'hashicorp', 'vercel',
  'linkedin', 'samsung', 'sony', 'siemens', 'bosch', 'philips',
];

function classifyJob(title, company, url, snippet) {
  const cats = [];
  const u = url.toLowerCase();
  const c = company.toLowerCase();
  const t = title.toLowerCase();
  const a = `${t} ${c} ${snippet.toLowerCase()}`;  // all text

  // Platform
  if (u.includes('zhipin.com'))           cats.push('BOSS直聘');
  else if (u.includes('liepin.com'))      cats.push('猎聘');
  else if (u.includes('lagou.com'))       cats.push('拉钩');
  else if (u.includes('zhaopin.com') || u.includes('zhilian')) cats.push('智联招聘');
  else if (u.includes('51job.com') || u.includes('51job')) cats.push('前程无忧');
  else if (u.includes('linkedin.com'))    cats.push('LinkedIn');
  else if (u.includes('indeed.com'))      cats.push('Indeed');

  // 大厂
  if (BIG_TECH.some((k) => c.includes(k) || a.includes(k))) cats.push('大厂');

  // 外企
  if (FOREIGN.some((k) => c.includes(k) || a.includes(k))) cats.push('外企');

  // Remote
  if (u.includes('remote') || t.includes('remote')) cats.push('远程');

  return cats;
}

function extractCompany(title, url) {
  for (const sep of [' at ', ' @ ', ' - ', ' | ', ' — ']) {
    const idx = title.indexOf(sep);
    if (idx !== -1) {
      for (const p of [title.slice(0, idx).trim(), title.slice(idx + sep.length).trim()]) {
        if (p && !/^\d/.test(p) && p.split(' ').length <= 5) return p;
      }
    }
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').replace(/^(careers|jobs|hiring)\./, '');
    const name = host.split('.')[0];
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Unknown';
  } catch { return 'Unknown'; }
}
