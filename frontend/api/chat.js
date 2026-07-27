/** Vercel Node.js Serverless Function — LLM chat proxy.
 *
 *  Frontend → POST /api/chat  →  OpenAI-compatible API → response.
 *  Supports DeepSeek, OpenAI, or any compatible endpoint.
 *  API keys from request body (frontend Settings).
 */

const JSONRPC = 'https://api.openai.com/v1/chat/completions';

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
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const messages    = Array.isArray(body.messages) ? body.messages : [];
  const apiKey      = (body.openaiApiKey || '').trim();
  const baseUrl     = (body.openaiBaseUrl || '').trim() || 'https://api.openai.com/v1';
  const model       = (body.openaiModel || '').trim() || 'gpt-4o-mini';

  if (!apiKey) {
    return json(res, 400, {
      error: 'OpenAI API Key 未配置 — 请在 Settings 中填写，或在 Vercel 环境变量中设置 VERCEL_OPENAI_KEY',
    });
  }

  if (!messages.length) {
    return json(res, 400, { error: 'messages array is required' });
  }

  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';

  try {
    const llmResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!llmResp.ok) {
      const errText = await llmResp.text().catch(() => '');
      return json(res, 502, { error: `LLM API ${llmResp.status}: ${errText.slice(0, 300)}` });
    }

    const data = await llmResp.json();
    const reply = data.choices?.[0]?.message?.content || '';
    return json(res, 200, { reply });
  } catch (err) {
    return json(res, 500, { error: `Chat failed: ${err.message}` });
  }
}
