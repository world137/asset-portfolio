/* api/auth.js — username + password authentication against Supabase users table
   POST /api/auth  { username, passwordHash }
   → 200 { ok: true, portfolioId }   on success
   → 401 { ok: false, error: 'invalid-credentials' }  on bad username/password
   → 503 if Supabase is not configured

   Prerequisites: run database/auth_migration.sql in Supabase SQL Editor first.
*/

import { readBody } from './_lib.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const USERNAME_RE   = /^.{1,64}$/;
const HASH_RE       = /^[a-f0-9]{64}$/;

function baseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'auth-not-configured' });
  }

  const body = await readBody(req);
  const { username, passwordHash } = body || {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'invalid-username' });
  }
  if (!passwordHash || !HASH_RE.test(passwordHash)) {
    return res.status(400).json({ error: 'invalid-hash' });
  }

  const uname = username.trim().toLowerCase();

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(uname)}&select=id,password_hash&limit=1`,
      { headers: baseHeaders() },
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`sb-query-${r.status}: ${text}`);
    }
    const rows = await r.json();
    const user = rows[0];

    if (!user || user.password_hash !== passwordHash) {
      return res.status(401).json({ ok: false, error: 'invalid-credentials' });
    }

    return res.status(200).json({ ok: true, portfolioId: user.id });
  } catch (e) {
    console.error('[auth] error:', e.message);
    return res.status(500).json({ error: 'auth-failed', detail: e.message });
  }
}
