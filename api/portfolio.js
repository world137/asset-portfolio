/* ============================================================================
   api/portfolio.js — Vercel Serverless Function (Node 18+ runtime)

   Persists portfolio data to Vercel KV (Upstash Redis via REST API).
   No npm package required — communicates with KV through native fetch.

   GET  /api/portfolio?id=<portfolioId>          → { data: <string> | null }
   POST /api/portfolio  body: { id, data }       → { ok: true }

   Environment variables (auto-set by Vercel when KV store is linked):
     KV_REST_API_URL   — e.g. https://xxx.kv.vercel-storage.com
     KV_REST_API_TOKEN — bearer token
   ============================================================================ */

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// Valid portfolio ID: alphanumeric + hyphens/underscores, 6–64 chars
const ID_RE  = /^[a-zA-Z0-9_-]{6,64}$/;
// Max portfolio payload: 200 KB
const MAX_LEN = 200 * 1024;
// Key TTL: 180 days, refreshed on every write
const TTL     = 15_552_000;

function kvKey(id) { return `pf:v1:${id}`; }

// Execute a single Redis command against the Upstash REST API.
async function kvCmd(...args) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error('kv-' + r.status);
  const j = await r.json();
  return j.result;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) {} }
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Graceful no-op when KV is not yet configured (lets localStorage keep working)
  if (!KV_URL || !KV_TOKEN) {
    if (req.method === 'GET')  return res.status(200).json({ data: null, warn: 'kv-not-configured' });
    if (req.method === 'POST') return res.status(200).json({ ok: true,   warn: 'kv-not-configured' });
    return res.status(405).end();
  }

  // ---------- GET -----------------------------------------------------------
  if (req.method === 'GET') {
    const id = (req.query || {}).id;
    if (!id || !ID_RE.test(id)) return res.status(400).json({ error: 'invalid-id' });
    try {
      const data = await kvCmd('GET', kvKey(id));
      // Refresh TTL passively on read so active portfolios never expire
      if (data != null) kvCmd('EXPIRE', kvKey(id), String(TTL)).catch(() => {});
      return res.status(200).json({ data: data ?? null });
    } catch (_) {
      return res.status(500).json({ error: 'read-failed' });
    }
  }

  // ---------- POST ----------------------------------------------------------
  if (req.method === 'POST') {
    const body = await readBody(req);
    const { id, data } = body || {};
    if (!id   || !ID_RE.test(id))              return res.status(400).json({ error: 'invalid-id' });
    if (!data || typeof data !== 'string')      return res.status(400).json({ error: 'invalid-data' });
    if (Buffer.byteLength(data, 'utf8') > MAX_LEN) return res.status(413).json({ error: 'too-large' });
    try {
      await kvCmd('SET', kvKey(id), data, 'EX', String(TTL));
      return res.status(200).json({ ok: true });
    } catch (_) {
      return res.status(500).json({ error: 'write-failed' });
    }
  }

  res.status(405).json({ error: 'method-not-allowed' });
}
