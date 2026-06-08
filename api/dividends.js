/* ============================================================================
   api/dividends.js — Vercel Serverless Function (Node 18+ runtime)

   Fetches dividend / distribution history for the user's HELD assets only.
   The browser can't reach Yahoo directly (no CORS headers), so this endpoint
   proxies the Yahoo Finance chart API with the `events=div` flag, which returns
   historical dividend events (ex-dividend date + amount per share).

   POST body (application/json):
   {
     yahoo: [{ key, name, symbol, ccy }]   // built client-side from holdings
   }

   Only Yahoo-priced equities (Thai/US stocks, ETFs) carry dividend events.
   Funds (settrade), crypto and gold are not queried.

   Response:
   {
     dividends: [
       { classKey, name, currency, exDate, payDate, amountPerShare, source }
     ],
     errors: [ "<key>:<name> reason", ... ],
     ts: <epoch ms>
   }
   ============================================================================ */

import { readBody } from './_lib.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Yahoo chart API with dividend events. range=2y keeps the payload small while
// covering the trailing 12 months plus a little history for the annual summary.
async function yahooDividends(symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y&events=div`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = new Error('no result'); continue; }
      const divs = result.events?.dividends || {};
      // { "<ts>": { amount, date } } → [{ exDate, amountPerShare }]
      return Object.values(divs)
        .filter(d => d && d.amount != null && d.date != null)
        .map(d => ({
          exDate: new Date(d.date * 1000).toISOString().slice(0, 10),
          amountPerShare: +(+d.amount).toFixed(6),
        }))
        .sort((a, b) => a.exDate.localeCompare(b.exDate));
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('yahoo failed');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = await readBody(req);
  const dividends = [];
  const errors = [];
  const tasks = [];

  for (const it of (body.yahoo || [])) {
    if (!it.symbol) continue;
    tasks.push(yahooDividends(it.symbol)
      .then(events => {
        for (const ev of events) {
          dividends.push({
            classKey:       it.key,
            name:           it.name,
            currency:       it.ccy || 'USD',
            exDate:         ev.exDate,
            // Yahoo only exposes the ex-dividend date; use it as the pay date
            // approximation so the entry lands on the calendar.
            payDate:        ev.exDate,
            amountPerShare: ev.amountPerShare,
            source:         'yahoo',
          });
        }
      })
      .catch(e => errors.push(`${it.key}:${it.name} ${e.message}`)));
  }

  await Promise.allSettled(tasks);

  // Dividend history changes at most quarterly — cache aggressively at the edge.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ dividends, errors, ts: Date.now() });
}
