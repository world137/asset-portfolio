/* ============================================================================
   api/scanner.js — Vercel Serverless Function (self-contained, no env vars)

   The scan logic lives in api/_scanner/ (port of the Go stock-scanner), over
   a bundled SP500 + NASDAQ100 + SET50 universe with prices from Yahoo.
   A full scan (~575 symbols) is too long for one function call, so the page
   drives it in slices and ranks the combined results itself.

   GET  /api/scanner               → { ok, total, filters }   universe size + thresholds
   POST /api/scanner { offset, limit } → { ok, total, next, scanned, candidates, skipped }
        scans UNIVERSE[offset, offset+limit); `next` is null when done.
   ============================================================================ */

import { readBody } from './_lib.js';
import { UNIVERSE } from './_scanner/universe.js';
import { CFG, evaluate, fetchBars } from './_scanner/engine.js';

const CONCURRENCY = 10;
const MAX_LIMIT = 80;

async function scanSlice(stocks) {
  const candidates = [];
  const skipped = {};
  let latest = 0;
  let i = 0;
  async function worker() {
    while (i < stocks.length) {
      const stock = stocks[i++];
      try {
        const bars = await fetchBars(stock[0]);
        latest = Math.max(latest, bars[bars.length - 1].ts);
        const out = evaluate(stock, bars);
        if (out.candidate) candidates.push(out.candidate);
      } catch (e) {
        skipped[stock[0]] = e.message;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stocks.length) }, worker));
  return { candidates, skipped, latest };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, total: UNIVERSE.length, filters: CFG });
  }
  if (req.method !== 'POST') return res.status(405).end();

  let body = {};
  try { body = await readBody(req); } catch { body = {}; }
  const offset = Math.max(0, parseInt(body.offset, 10) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(body.limit, 10) || 50));
  const slice = UNIVERSE.slice(offset, offset + limit);

  try {
    const { candidates, skipped, latest } = await scanSlice(slice);
    const next = offset + slice.length < UNIVERSE.length ? offset + slice.length : null;
    return res.status(200).json({
      ok: true, total: UNIVERSE.length, next, scanned: slice.length,
      candidates, skipped, marketDataTimestamp: latest ? new Date(latest * 1000).toISOString() : null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'scanner-error', message: e.message });
  }
}
