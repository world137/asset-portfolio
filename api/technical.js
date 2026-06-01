/* ============================================================================
   api/technical.js — Vercel Serverless Function
   GET /api/technical?symbol=AAPL&range=2y
   Returns OHLCV bars from Yahoo Finance for technical analysis computation.
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const symbol = (req.query.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const range = req.query.range || '2y';
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;

  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = new Error('no data returned'); continue; }

      const timestamps = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};

      const bars = timestamps.map((t, i) => ({
        t,
        o: q.open?.[i] ?? null,
        h: q.high?.[i] ?? null,
        l: q.low?.[i] ?? null,
        c: q.close?.[i] ?? null,
        v: q.volume?.[i] ?? null,
      })).filter(b => b.c != null && b.h != null && b.l != null);

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({
        bars,
        currency: result.meta?.currency || null,
        symbol:   result.meta?.symbol   || symbol,
        name:     result.meta?.shortName || result.meta?.longName || symbol,
      });
    } catch (e) { lastErr = e; }
  }

  return res.status(500).json({ error: lastErr?.message || 'fetch failed' });
}
