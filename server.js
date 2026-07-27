const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function serveFile(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function handleApiSearch(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const params = JSON.parse(body);
      const query = (params.query || '').trim();
      const location = (params.location || '').trim();
      const remoteOnly = !!params.remoteOnly;
      const maxResults = Math.min(Math.max(parseInt(params.maxResults, 10) || 10, 1), 50);
      const apiKey = (params.tavilyApiKey || '').trim() || process.env.VERCEL_TAVILY_KEY || '';
      const categories = Array.isArray(params.categories) ? params.categories : [];

      if (!query) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'query is required' }));
        return;
      }

      if (!apiKey) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          error: 'Tavily API Key 未配置 — 请在 Settings 中填写，或在环境变量中设置 VERCEL_TAVILY_KEY',
        }));
        return;
      }

      let searchQ = query;
      if (remoteOnly) searchQ += ' remote';
      if (location) searchQ += ` ${location}`;

      const PLATFORM_MAP = {
        'BOSS直聘': 'zhipin.com', '猎聘': 'liepin.com', '拉钩': 'lagou.com',
        '智联招聘': 'zhaopin.com', 'LinkedIn': 'linkedin.com', 'Indeed': 'indeed.com',
      };
      const selPlats = categories.filter(c => PLATFORM_MAP[c]).map(c => PLATFORM_MAP[c]);
      if (selPlats.length === 1) searchQ += ` site:${selPlats[0]}`;
      else if (selPlats.length > 1) searchQ += ` (${selPlats.map(s => `site:${s}`).join(' OR ')})`;

      const BIG_TECH = ['ByteDance','Tencent','Alibaba','Baidu','Meituan','JD.com','Xiaomi','Huawei'];
      const FOREIGN  = ['Google','Microsoft','Apple','Amazon','Meta','Netflix','Uber','Shopify'];
      if (categories.includes('大厂')) searchQ += ` (${BIG_TECH.join(' OR ')})`;
      if (categories.includes('外企')) searchQ += ` (${FOREIGN.join(' OR ')})`;

      const tavilyResp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: searchQ,
          search_depth: 'advanced',
          include_raw_content: false,
          max_results: Math.min(maxResults, 20),
        }),
      });

      if (!tavilyResp.ok) {
        const errText = await tavilyResp.text().catch(() => '');
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: `Tavily API ${tavilyResp.status}: ${errText.slice(0, 200)}` }));
        return;
      }

      const data = await tavilyResp.json();
      const jobs = (data.results || []).map((hit) => {
        const title = hit.title || '';
        const url = hit.url || '';
        const company = extractCompany(title, url);
        const snippet = (hit.content || '').slice(0, 500);
        return {
          id: url || title,
          title,
          company,
          location: '',
          salary: '',
          url,
          post_date: '',
          snippet,
          match_score: 0,
          missing_skills: [],
          categories: classifyJob(title, company, url, snippet),
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ jobs }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: `Search failed: ${err.message}` }));
    }
  });
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
  const a = `${t} ${c} ${snippet.toLowerCase()}`;

  if (u.includes('zhipin.com'))           cats.push('BOSS直聘');
  else if (u.includes('liepin.com'))      cats.push('猎聘');
  else if (u.includes('lagou.com'))       cats.push('拉钩');
  else if (u.includes('zhaopin.com') || u.includes('zhilian')) cats.push('智联招聘');
  else if (u.includes('51job.com') || u.includes('51job')) cats.push('前程无忧');
  else if (u.includes('linkedin.com'))    cats.push('LinkedIn');
  else if (u.includes('indeed.com'))      cats.push('Indeed');

  if (BIG_TECH.some((k) => c.includes(k) || a.includes(k))) cats.push('大厂');
  if (FOREIGN.some((k) => c.includes(k) || a.includes(k))) cats.push('外企');
  if (u.includes('remote') || t.includes('remote')) cats.push('远程');

  return cats;
}

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(FRONTEND_DIR, url);
  console.log(`${new Date().toISOString()} - ${req.method} ${url} from ${req.socket.remoteAddress}`);

  if (req.method === 'POST' && url === '/api/search') {
    handleApiSearch(req, res);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    serveFile(req, res, filePath);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
