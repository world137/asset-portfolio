/* ============================================================================
   api/watchlist.js — Vercel Serverless Function

   Persists watchlist items to Supabase via the Supabase REST API.

   GET  /api/watchlist?id=<portfolioId>         → { items: [...] }
   POST /api/watchlist  body: { id, items: [...] } → { ok: true }
   ============================================================================ */

import { readBody } from './_lib.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;

function baseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sbGet(table, qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: baseHeaders() });
  if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`sb-get-${r.status}: ${b}`); }
  return r.json();
}

async function sbDelete(table, qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'DELETE',
    headers: baseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`sb-delete-${r.status}: ${b}`); }
}

async function sbUpsert(table, rows) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: baseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`sb-upsert-${r.status}: ${b}`); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Graceful fallback when Supabase is not configured (local dev without .env)
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (req.method === 'GET')  return res.status(200).json({ items: [] });
    if (req.method === 'POST') return res.status(200).json({ ok: true, warn: 'supabase-not-configured' });
    return res.status(405).end();
  }

  // ── GET — load watchlist for a portfolio ────────────────────────────────────
  if (req.method === 'GET') {
    const id = (req.query || {}).id;
    if (!id || !ID_RE.test(id)) return res.status(400).json({ error: 'invalid-id' });
    try {
      const rows = await sbGet(
        'watchlist',
        `portfolio_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`,
      );
      const items = rows.map(r => ({
        ticker: r.ticker,
        type:   r.type || 'stock',
        name:   r.name || null,
      }));
      return res.status(200).json({ items });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST — replace entire watchlist for a portfolio ──────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return res.status(400).json({ error: 'bad-body' }); }

    const { id, items } = body || {};
    if (!id || !ID_RE.test(id))  return res.status(400).json({ error: 'invalid-id' });
    if (!Array.isArray(items))   return res.status(400).json({ error: 'items must be array' });

    try {
      // Delete current rows for this portfolio, then bulk-insert the new list.
      await sbDelete('watchlist', `portfolio_id=eq.${encodeURIComponent(id)}`);
      if (items.length > 0) {
        const rows = items.map(item => ({
          portfolio_id: id,
          ticker:       String(item.ticker).slice(0, 20).toUpperCase(),
          type:         item.type === 'crypto' ? 'crypto' : 'stock',
          name:         item.name ? String(item.name).slice(0, 120) : null,
        }));
        await sbUpsert('watchlist', rows);
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
}
