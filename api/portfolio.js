/* ============================================================================
   api/portfolio.js — Vercel Serverless Function (Node 18+ runtime)

   Persists portfolio data to Supabase (Postgres) via the Supabase REST API
   using normalized tables (users, settings, holdings, sectors, snapshots,
   fx_rates, sales).  No npm package required — uses native fetch.

   GET  /api/portfolio?id=<portfolioId>     → { data: <json-string> | null }
   POST /api/portfolio  body: { id, data }  → { ok: true }

   ── Supabase setup ───────────────────────────────────────────────────────────
   Run schema.sql in the Supabase SQL Editor, then add env vars:
     SUPABASE_URL         → https://<project-ref>.supabase.co
     SUPABASE_SERVICE_KEY → Settings → API → service_role (secret)

   ── Local dev ────────────────────────────────────────────────────────────────
   .env.local:
     SUPABASE_URL=https://<project-ref>.supabase.co
     SUPABASE_SERVICE_KEY=<service_role_key>
   Then: npx vercel dev
   ============================================================================ */

import { readBody } from './_lib.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ID_RE      = /^[a-zA-Z0-9_-]{6,64}$/;
const MAX_LEN    = 500 * 1024;
const MAX_SNAPSHOTS = 730;

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

async function sbInsert(table, rows) {
  if (!rows || !rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: baseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`sb-insert-${table}-${r.status}: ${body}`);
  }
}

// ── Shape helpers ─────────────────────────────────────────────────────────────

// Reconstruct the JS state object (same shape store.js expects) from DB rows.
function buildState(settingsRows, holdingRows, sectorRows, snapshotRows, saleRows, fxRows, marketPriceRows) {
  // Build lookup: "classKey:name" → current market price
  const mpMap = {};
  for (const mp of (marketPriceRows || [])) {
    mpMap[`${mp.class_key}:${mp.name}`] = parseFloat(mp.price);
  }

  const holdingsMap = {};
  for (const lot of holdingRows) {
    const mpPrice = mpMap[`${lot.class_key}:${lot.name}`];
    (holdingsMap[lot.class_key] ||= []).push({
      id:    lot.id,
      name:  lot.name,
      type:  lot.type || undefined,
      price: parseFloat(lot.price),
      qty:   parseFloat(lot.qty),
      // Prefer market_prices; fall back to holdings.cur during migration
      cur:   mpPrice != null ? mpPrice : (lot.cur != null ? parseFloat(lot.cur) : undefined),
    });
  }

  const sectorsMap = {};
  for (const s of sectorRows) sectorsMap[`${s.class_key}:${s.name}`] = s.sector;

  const fx = { USDTHB: null, JPYTHB: null, KRWTHB: null, at: null };
  for (const row of fxRows) {
    if (row.pair === 'USDTHB') fx.USDTHB = parseFloat(row.rate);
    else if (row.pair === 'JPYTHB') fx.JPYTHB = parseFloat(row.rate);
    else if (row.pair === 'KRWTHB') fx.KRWTHB = parseFloat(row.rate);
  }

  const s = settingsRows[0] || {};
  const settings = {
    displayCcy: s.display_ccy  || 'THB',
    theme:      s.theme        || 'light',
    chartStyle: s.chart_style  || 'donut',
    palette:    s.palette      || 'class',
    layout:     s.layout       || 'overview',
    decimals:   s.decimals     ?? 2,
  };

  return {
    holdings:      holdingsMap,
    sectors:       sectorsMap,
    fx,
    settings,
    snapshots: snapshotRows.map(r => {
      const snap = { date: r.date, value: parseFloat(r.value) };
      if (r.thai_stock != null) snap.thaiStock = parseFloat(r.thai_stock);
      if (r.usa_stock  != null) snap.usaStock  = parseFloat(r.usa_stock);
      if (r.etf        != null) snap.etf       = parseFloat(r.etf);
      if (r.fund       != null) snap.fund      = parseFloat(r.fund);
      if (r.crypto     != null) snap.crypto    = parseFloat(r.crypto);
      if (r.gold       != null) snap.gold      = parseFloat(r.gold);
      if (r.other      != null) snap.other     = parseFloat(r.other);
      return snap;
    }),
    sales:         saleRows.map(r => ({
      id:          r.id,
      date:        r.date,
      classKey:    r.class_key,
      name:        r.name,
      ccy:         r.ccy,
      buyPrice:    parseFloat(r.buy_price),
      sellPrice:   parseFloat(r.sell_price),
      qty:         parseFloat(r.qty),
      cost:        parseFloat(r.cost),
      proceeds:    parseFloat(r.proceeds),
      realizedPnl: parseFloat(r.realized_pnl),
      pnlPct:      parseFloat(r.pnl_pct),
    })),
    lastPriceSync: null,
    priceMode:     null,
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
      const SNAPSHOT_COLS = 'date,value,thai_stock,usa_stock,etf,fund,crypto,gold,other';
      const [settingsRows, holdingRows, sectorRows, snapshotRows, saleRows, fxRows, marketPriceRows] =
        await Promise.all([
          sbGet('settings',      `user_id=eq.${uid}&select=*`),
          sbGet('holdings',      `user_id=eq.${uid}&select=*&order=created_at.asc`),
          sbGet('sectors',       `user_id=eq.${uid}&select=*`),
          sbGet('snapshots',     `user_id=eq.${uid}&select=${SNAPSHOT_COLS}&order=date.asc&limit=${MAX_SNAPSHOTS}`),
          sbGet('sales',         `user_id=eq.${uid}&select=*&order=date.asc`),
          sbGet('fx_rates',      `user_id=eq.${uid}&select=*`),
          sbGet('market_prices', `user_id=eq.${uid}&select=class_key,name,price`),
        ]);

      // No data at all → new user
      const empty = !settingsRows.length && !holdingRows.length &&
                    !snapshotRows.length && !saleRows.length;
      if (empty) return res.status(200).json({ data: null });

      const state = buildState(settingsRows, holdingRows, sectorRows, snapshotRows, saleRows, fxRows, marketPriceRows);
      return res.status(200).json({ data: JSON.stringify(state) });
    } catch (e) {
      console.error('[portfolio] get error:', e.message);
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
      // 1. Ensure user row exists
      await sbUpsert('users', [{ id, updated_at: now }]);

      // 2. Settings (upsert single row)
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

      // 3. Holdings — full replace (delete then bulk insert)
      // Also collect unique current prices for market_prices table.
      const holdingRows = [];
      const mpMap = new Map(); // "classKey:name" → { class_key, name, price }
      for (const [classKey, lots] of Object.entries(p.holdings || {})) {
        for (const lot of (lots || [])) {
          holdingRows.push({
            id:        lot.id,
            user_id:   id,
            class_key: classKey,
            name:      lot.name,
            type:      lot.type || null,
            price:     lot.price,
            qty:       lot.qty,
            cur:       lot.cur != null ? lot.cur : null,
          });
          if (lot.cur != null) {
            mpMap.set(`${classKey}:${lot.name}`, { class_key: classKey, name: lot.name, price: lot.cur });
          }
        }
      }
      await sbDelete('holdings', `user_id=eq.${uid}`);
      if (holdingRows.length > 0) await sbUpsert('holdings', holdingRows);

      // Upsert latest prices to market_prices (replaces holdings.cur as the live-price store)
      const mpRows = [...mpMap.values()].map(m => ({
        user_id: id, class_key: m.class_key, name: m.name, price: m.price,
        source: 'app', refreshed_at: now,
      }));
      if (mpRows.length > 0) await sbUpsert('market_prices', mpRows);

      // Append price_history and fx_rate_history only on price-refresh saves
      // (lastPriceSync is set to Date.now() by store.js immediately after applyPrices)
      const isRecentSync = p.lastPriceSync && (Date.now() - p.lastPriceSync < 5 * 60 * 1000);
      if (isRecentSync && mpRows.length > 0) {
        await sbInsert('price_history', mpRows.map(m => ({
          user_id: id, class_key: m.class_key, name: m.name,
          price: m.price, source: m.source, recorded_at: now,
        })));
      }

      // 4. Sectors — full replace
      await sbDelete('sectors', `user_id=eq.${uid}`);
      const sectorRows = [];
      for (const [key, sector] of Object.entries(p.sectors || {})) {
        const i = key.indexOf(':');
        if (i < 0) continue;
        sectorRows.push({ user_id: id, class_key: key.slice(0, i), name: key.slice(i + 1), sector });
      }
      await sbUpsert('sectors', sectorRows);

      // 5. Snapshots — upsert by (user_id, date) to preserve history
      const snapshotRows = (p.snapshots || []).map(s => ({
        user_id:    id,
        date:       s.date,
        value:      s.value,
        thai_stock: s.thaiStock ?? null,
        usa_stock:  s.usaStock  ?? null,
        etf:        s.etf       ?? null,
        fund:       s.fund      ?? null,
        crypto:     s.crypto    ?? null,
        gold:       s.gold      ?? null,
        other:      s.other     ?? null,
      }));
      await sbUpsert('snapshots', snapshotRows);

      // 6. Sales — full replace
      await sbDelete('sales', `user_id=eq.${uid}`);
      const saleRows = (p.sales || []).map(s => ({
        id:          s.id,
        user_id:     id,
        date:        s.date,
        class_key:   s.classKey,
        name:        s.name,
        ccy:         s.ccy || 'THB',
        buy_price:   s.buyPrice,
        sell_price:  s.sellPrice,
        qty:         s.qty,
        cost:        s.cost,
        proceeds:    s.proceeds,
        realized_pnl: s.realizedPnl,
        pnl_pct:     s.pnlPct,
      }));
      await sbUpsert('sales', saleRows);

      // 7. FX rates (USDTHB, JPYTHB, KRWTHB)
      const fxPairs = ['USDTHB', 'JPYTHB', 'KRWTHB'];
      const fxRows = fxPairs.filter(pair => p.fx?.[pair]).map(pair => ({
        user_id: id, pair, rate: p.fx[pair], recorded_at: now,
      }));
      if (fxRows.length) {
        await sbUpsert('fx_rates', fxRows);
        if (isRecentSync) {
          await sbInsert('fx_rate_history', fxRows.map(r => ({
            user_id: id, pair: r.pair, rate: r.rate, recorded_at: now,
          })));
        }
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[portfolio] save error:', e.message);
      return res.status(500).json({ error: 'write-failed', detail: e.message });
    }
  }

  res.status(405).json({ error: 'method-not-allowed' });
}
