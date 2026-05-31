/* ============================================================================
   api/data-transfer.js — Import all user data from a backup payload.

   Export is handled client-side by calling /api/portfolio and /api/wallet
   directly, then zipping the results with JSZip.

   POST /api/data-transfer
        body: { id, mode: "override"|"topup", portfolio?, wallet? }
        → { ok: true }

   mode "override" — deletes all existing data then inserts from payload.
   mode "topup"    — inserts only new items (by primary key); existing rows win.
   ============================================================================ */

import { readBody } from './_lib.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ID_RE   = /^[a-zA-Z0-9_-]{6,64}$/;
const MAX_LEN = 2 * 1024 * 1024; // 2 MB

// ── Supabase helpers ──────────────────────────────────────────────────────────

function baseHeaders(extra = {}) {
  return {
    apikey:        SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sbDelete(table, qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'DELETE', headers: baseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`sb-delete-${table}-${r.status}: ${b}`); }
}

async function sbUpsert(table, rows, resolution = 'merge-duplicates') {
  if (!rows?.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: baseHeaders({ Prefer: `resolution=${resolution},return=minimal` }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`sb-upsert-${table}-${r.status}: ${b}`); }
}

// ── Import: write all tables from payload ─────────────────────────────────────

async function importAll(id, mode, portfolio, wallet) {
  const now = new Date().toISOString();
  const uid = encodeURIComponent(id);
  // ignore-duplicates = existing rows win (topup); merge-duplicates = payload wins (override)
  const res = mode === 'override' ? 'merge-duplicates' : 'ignore-duplicates';

  await sbUpsert('users', [{ id, updated_at: now }]);

  if (portfolio) {
    const p = portfolio;

    if (mode === 'override') {
      const s = p.settings || {};
      await sbUpsert('settings', [{
        user_id:     id,
        display_ccy: s.displayCcy  || 'THB',
        theme:       s.theme       || 'light',
        chart_style: s.chartStyle  || 'donut',
        palette:     s.palette     || 'class',
        layout:      s.layout      || 'overview',
        decimals:    s.decimals    ?? 2,
        updated_at:  now,
      }]);

      await sbDelete('holdings',  `user_id=eq.${uid}`);
      await sbDelete('sectors',   `user_id=eq.${uid}`);
      await sbDelete('snapshots', `user_id=eq.${uid}`);
      await sbDelete('sales',     `user_id=eq.${uid}`);
    }

    // Holdings
    const holdingRows = [];
    for (const [classKey, lots] of Object.entries(p.holdings || {})) {
      for (const lot of (lots || [])) {
        holdingRows.push({
          id: lot.id, user_id: id, class_key: classKey,
          name: lot.name, type: lot.type || null,
          price: lot.price, qty: lot.qty, cur: lot.cur ?? null,
        });
      }
    }
    await sbUpsert('holdings', holdingRows, res);

    // Sectors (always merge — sector tag updates are safe in topup too)
    const sectorRows = [];
    for (const [key, sector] of Object.entries(p.sectors || {})) {
      const i = key.indexOf(':');
      if (i < 0) continue;
      sectorRows.push({ user_id: id, class_key: key.slice(0, i), name: key.slice(i + 1), sector });
    }
    await sbUpsert('sectors', sectorRows, 'merge-duplicates');

    // Snapshots (topup: keep existing date values; override: replace)
    const snapshotRows = (p.snapshots || []).map(s => ({
      user_id: id, date: s.date, value: s.value,
      thai_stock: s.thaiStock ?? null, usa_stock: s.usaStock ?? null,
      etf: s.etf ?? null, fund: s.fund ?? null, crypto: s.crypto ?? null,
      gold: s.gold ?? null, other: s.other ?? null,
    }));
    await sbUpsert('snapshots', snapshotRows, res);

    // Sales
    const saleRows = (p.sales || []).map(s => ({
      id: s.id, user_id: id, date: s.date, class_key: s.classKey, name: s.name,
      ccy: s.ccy || 'THB', buy_price: s.buyPrice, sell_price: s.sellPrice,
      qty: s.qty, cost: s.cost, proceeds: s.proceeds,
      realized_pnl: s.realizedPnl, pnl_pct: s.pnlPct,
    }));
    await sbUpsert('sales', saleRows, res);

    // FX rates (override only — topup keeps existing live rates)
    if (mode === 'override') {
      const fxPairs = ['USDTHB', 'JPYTHB', 'KRWTHB'];
      const fxRows  = fxPairs.filter(pair => p.fx?.[pair]).map(pair => ({
        user_id: id, pair, rate: p.fx[pair], recorded_at: now,
      }));
      if (fxRows.length) await sbUpsert('fx_rates', fxRows);
    }
  }

  if (wallet) {
    const w = wallet;

    if (mode === 'override') {
      // Delete in dependency order (transactions → accounts/debts → categories)
      await sbDelete('wallet_transactions', `user_id=eq.${uid}`);
      await sbDelete('wallet_debts',        `user_id=eq.${uid}`);
      await sbDelete('wallet_accounts',     `user_id=eq.${uid}`);
      await sbDelete('wallet_categories',   `user_id=eq.${uid}`);
    }

    const accountRows = (w.accounts || []).map(a => ({
      id: a.id, user_id: id, name: a.name, type: a.type || 'bank',
      currency: a.currency || 'THB', color: a.color || null,
      initial_bal: a.initialBal ?? 0, credit_limit: a.creditLimit ?? null,
      sort_order: a.sortOrder ?? 0, archived: a.archived ?? false,
    }));
    await sbUpsert('wallet_accounts', accountRows, res);

    const categoryRows = (w.categories || []).map(c => ({
      id: c.id, user_id: id, name: c.name, flow: c.flow,
      icon: c.icon || null, color: c.color || null,
    }));
    await sbUpsert('wallet_categories', categoryRows, res);

    const txnRows = (w.transactions || []).map(t => ({
      id: t.id, user_id: id, account_id: t.accountId, date: t.date,
      amount: t.amount, flow: t.flow, category_id: t.categoryId || null,
      note: t.note || null, to_account_id: t.toAccountId || null, fx_rate: t.fxRate ?? null,
    }));
    await sbUpsert('wallet_transactions', txnRows, res);

    const debtRows = (w.debts || []).map(d => ({
      id: d.id, user_id: id, direction: d.direction, counterparty: d.counterparty,
      amount: d.amount, currency: d.currency || 'THB', date_start: d.dateStart,
      date_due: d.dateDue || null, note: d.note || null, settled: d.settled ?? false,
      settled_date: d.settledDate || null, linked_account_id: d.linkedAccountId || null,
      inst_months:        d.installment?.months       ?? null,
      inst_interest_rate: d.installment?.interestRate ?? null,
      inst_paid_months:   d.installment?.paidMonths   ?? 0,
      installment:        d.installment || null,
    }));
    await sbUpsert('wallet_debts', debtRows, res);
  }
}

// ── Handler (POST only) ───────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ ok: true, warn: 'supabase-not-configured' });
  }

  let body;
  try { body = await readBody(req); } catch (_) { return res.status(400).json({ error: 'bad-body' }); }
  const { id, mode, portfolio, wallet } = body || {};

  if (!id  || !ID_RE.test(id))              return res.status(400).json({ error: 'invalid-id' });
  if (!['override', 'topup'].includes(mode)) return res.status(400).json({ error: 'invalid-mode' });
  if (!portfolio && !wallet)                 return res.status(400).json({ error: 'no-data' });

  const bodyLen = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (bodyLen > MAX_LEN) return res.status(413).json({ error: 'too-large' });

  try {
    await importAll(id, mode, portfolio || null, wallet || null);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[data-transfer] import error:', e.message);
    return res.status(500).json({ error: 'import-failed', detail: e.message });
  }
}
