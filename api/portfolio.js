/* ============================================================================
   api/portfolio.js — Vercel Serverless Function (Node 18+ runtime)

   Persists portfolio data to Supabase (Postgres) via the Supabase REST API.
   No npm package required — uses native fetch.

   GET  /api/portfolio?id=<portfolioId>     → { data: <string> | null }
   POST /api/portfolio  body: { id, data }  → { ok: true }

   ── Supabase setup (one-time) ───────────────────────────────────────────────
   1. Create a project at https://supabase.com
   2. In SQL Editor run:

        create table portfolios (
          id          text        primary key,
          data        text        not null,
          updated_at  timestamptz default now()
        );

        -- Only service-role key has access (no public/anon exposure)
        alter table portfolios enable row level security;

   3. Add these env vars in Vercel → Project → Settings → Environment Variables:
        SUPABASE_URL          → https://<project-ref>.supabase.co
        SUPABASE_SERVICE_KEY  → Settings → API → service_role (secret)

   ── Local dev ────────────────────────────────────────────────────────────────
   Create a .env.local file in the project root:
        SUPABASE_URL=https://<project-ref>.supabase.co
        SUPABASE_SERVICE_KEY=<service_role_key>
   Then run:  npx vercel dev
   ============================================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ID_RE  = /^[a-zA-Z0-9_-]{6,64}$/;
const MAX_LEN = 200 * 1024;

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
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

  // Graceful no-op when Supabase is not yet configured
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (req.method === 'GET')  return res.status(200).json({ data: null, warn: 'supabase-not-configured' });
    if (req.method === 'POST') return res.status(200).json({ ok: true,  warn: 'supabase-not-configured' });
    return res.status(405).end();
  }

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = (req.query || {}).id;
    if (!id || !ID_RE.test(id)) return res.status(400).json({ error: 'invalid-id' });

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/portfolios?id=eq.${encodeURIComponent(id)}&select=data`,
        { headers: sbHeaders() }
      );
      if (!r.ok) throw new Error('sb-read-' + r.status);
      const rows = await r.json();
      const data = rows.length ? rows[0].data : null;
      return res.status(200).json({ data });
    } catch (_) {
      return res.status(500).json({ error: 'read-failed' });
    }
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await readBody(req);
    const { id, data } = body || {};
    if (!id   || !ID_RE.test(id))          return res.status(400).json({ error: 'invalid-id' });
    if (!data || typeof data !== 'string') return res.status(400).json({ error: 'invalid-data' });
    if (Buffer.byteLength(data, 'utf8') > MAX_LEN) return res.status(413).json({ error: 'too-large' });

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/portfolios`, {
        method: 'POST',
        headers: {
          ...sbHeaders(),
          // Upsert: insert or update if id already exists
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error('sb-write-' + r.status);
      return res.status(200).json({ ok: true });
    } catch (_) {
      return res.status(500).json({ error: 'write-failed' });
    }
  }

  res.status(405).json({ error: 'method-not-allowed' });
}
