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
      const jobs = (data.results || []).map((hit) => ({
        id: hit.url || hit.title,
        title: hit.title || '',
        company: extractCompany(hit.title || '', hit.url || ''),
        location: '',
        salary: '',
        url: hit.url || '',
        post_date: '',
        snippet: (hit.content || '').slice(0, 500),
        match_score: 0,
        missing_skills: [],
      }));

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

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(FRONTEND_DIR, url);

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
