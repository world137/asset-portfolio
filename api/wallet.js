/* ============================================================================
   api/wallet.js — Vercel Serverless Function (Node 18+ runtime)

   Persists wallet data to Supabase (Postgres) via the Supabase REST API.
   Follows the same pattern as api/portfolio.js.

   GET  /api/wallet?id=<portfolioId>     → { data: <json-string> | null }
   POST /api/wallet  body: { id, data }  → { ok: true }
   ============================================================================ */

import { readBody } from './_lib.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ID_RE  = /^[a-zA-Z0-9_-]{6,64}$/;
const MAX_LEN = 500 * 1024;

// ── Supabase REST helpers ─────────────────────────────────────────────────────

function baseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sbGet(table, qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: baseHeaders(),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`sb-get-${table}-${r.status}: ${body}`);
  }
  return r.json();
}

async function sbDelete(table, qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'DELETE',
    headers: baseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`sb-delete-${table}-${r.status}: ${body}`);
  }
}

async function sbUpsert(table, rows) {
  if (!rows || !rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: baseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`sb-upsert-${table}-${r.status}: ${body}`);
  }
}

// ── Shape helpers ─────────────────────────────────────────────────────────────

function buildWalletState(accountRows, categoryRows, txnRows, debtRows) {
  return {
    accounts: accountRows.map(r => ({
      id:          r.id,
      name:        r.name,
      type:        r.type,
      currency:    r.currency,
      color:       r.color || null,
      initialBal:  parseFloat(r.initial_bal),
      creditLimit: r.credit_limit != null ? parseFloat(r.credit_limit) : null,
      sortOrder:   r.sort_order,
      archived:    r.archived,
    })),
    categories: categoryRows.map(r => ({
      id:    r.id,
      name:  r.name,
      flow:  r.flow,
      icon:  r.icon || null,
      color: r.color || null,
    })),
    transactions: txnRows.map(r => ({
      id:          r.id,
      accountId:   r.account_id,
      date:        r.date,
      amount:      parseFloat(r.amount),
      flow:        r.flow,
      categoryId:  r.category_id || null,
      note:        r.note || '',
      toAccountId: r.to_account_id || null,
      fxRate:      r.fx_rate != null ? parseFloat(r.fx_rate) : null,
    })),
    debts: debtRows.map(r => ({
      id:              r.id,
      direction:       r.direction,
      counterparty:    r.counterparty,
      amount:          parseFloat(r.amount),
      currency:        r.currency,
      dateStart:       r.date_start,
      dateDue:         r.date_due || null,
      note:            r.note || '',
      settled:         r.settled,
      settledDate:     r.settled_date || null,
      linkedAccountId: r.linked_account_id || null,
      // Prefer typed columns; fall back to JSONB for rows not yet migrated
      installment: r.inst_months != null
        ? { months: r.inst_months, interestRate: parseFloat(r.inst_interest_rate ?? 0), paidMonths: r.inst_paid_months ?? 0 }
        : (r.installment || null),
    })),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (req.method === 'GET')  return res.status(200).json({ data: null, warn: 'supabase-not-configured' });
    if (req.method === 'POST') return res.status(200).json({ ok: true,  warn: 'supabase-not-configured' });
    return res.status(405).end();
  }

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = (req.query || {}).id;
    if (!id || !ID_RE.test(id)) return res.status(400).json({ error: 'invalid-id' });

    const uid = encodeURIComponent(id);
    try {
      const [accountRows, categoryRows, txnRows, debtRows] = await Promise.all([
        sbGet('wallet_accounts',     `user_id=eq.${uid}&select=*&order=sort_order.asc,created_at.asc`),
        sbGet('wallet_categories',   `user_id=eq.${uid}&select=*`),
        sbGet('wallet_transactions', `user_id=eq.${uid}&select=*&order=date.asc,created_at.asc`),
        sbGet('wallet_debts',        `user_id=eq.${uid}&select=*&order=date_start.asc`),
      ]);

      const empty = !accountRows.length && !categoryRows.length &&
                    !txnRows.length && !debtRows.length;
      if (empty) return res.status(200).json({ data: null });

      const wallet = buildWalletState(accountRows, categoryRows, txnRows, debtRows);
      return res.status(200).json({ data: JSON.stringify(wallet) });
    } catch (e) {
      console.error('[wallet] get error:', e.message);
      return res.status(500).json({ error: 'read-failed', detail: e.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await readBody(req);
    const { id, data } = body || {};
    if (!id   || !ID_RE.test(id))         return res.status(400).json({ error: 'invalid-id' });
    if (!data || typeof data !== 'string') return res.status(400).json({ error: 'invalid-data' });
    if (Buffer.byteLength(data, 'utf8') > MAX_LEN) return res.status(413).json({ error: 'too-large' });

    let p;
    try { p = JSON.parse(data); } catch (_) { return res.status(400).json({ error: 'invalid-json' }); }

    const now = new Date().toISOString();
    const uid = encodeURIComponent(id);

    try {
      // Ensure user row exists
      await sbUpsert('users', [{ id, updated_at: now }]);

      // Accounts — full replace
      await sbDelete('wallet_accounts', `user_id=eq.${uid}`);
      const accountRows = (p.accounts || []).map(a => ({
        id:           a.id,
        user_id:      id,
        name:         a.name,
        type:         a.type || 'bank',
        currency:     a.currency || 'THB',
        color:        a.color || null,
        initial_bal:  a.initialBal ?? 0,
        credit_limit: a.creditLimit ?? null,
        sort_order:   a.sortOrder ?? 0,
        archived:     a.archived ?? false,
      }));
      await sbUpsert('wallet_accounts', accountRows);

      // Categories — full replace
      await sbDelete('wallet_categories', `user_id=eq.${uid}`);
      const categoryRows = (p.categories || []).map(c => ({
        id:      c.id,
        user_id: id,
        name:    c.name,
        flow:    c.flow,
        icon:    c.icon || null,
        color:   c.color || null,
      }));
      await sbUpsert('wallet_categories', categoryRows);

      // Transactions — full replace
      await sbDelete('wallet_transactions', `user_id=eq.${uid}`);
      const txnRows = (p.transactions || []).map(t => ({
        id:            t.id,
        user_id:       id,
        account_id:    t.accountId,
        date:          t.date,
        amount:        t.amount,
        flow:          t.flow,
        category_id:   t.categoryId || null,
        note:          t.note || null,
        to_account_id: t.toAccountId || null,
        fx_rate:       t.fxRate ?? null,
      }));
      await sbUpsert('wallet_transactions', txnRows);

      // Debts — full replace
      await sbDelete('wallet_debts', `user_id=eq.${uid}`);
      const debtRows = (p.debts || []).map(d => ({
        id:                 d.id,
        user_id:            id,
        direction:          d.direction,
        counterparty:       d.counterparty,
        amount:             d.amount,
        currency:           d.currency || 'THB',
        date_start:         d.dateStart,
        date_due:           d.dateDue || null,
        note:               d.note || null,
        settled:            d.settled ?? false,
        settled_date:       d.settledDate || null,
        linked_account_id:  d.linkedAccountId || null,
        // Normalized installment columns (replaces JSONB over time)
        inst_months:        d.installment?.months        ?? null,
        inst_interest_rate: d.installment?.interestRate  ?? null,
        inst_paid_months:   d.installment?.paidMonths    ?? 0,
        // Keep JSONB for backward compat until DROP COLUMN migration is run
        installment:        d.installment || null,
      }));
      await sbUpsert('wallet_debts', debtRows);

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[wallet] save error:', e.message);
      return res.status(500).json({ error: 'write-failed', detail: e.message });
    }
  }

  res.status(405).json({ error: 'method-not-allowed' });
}
