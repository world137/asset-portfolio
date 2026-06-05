/* ============================================================================
   api/bonds.js — Vercel Serverless Function
   GET /api/bonds
   Returns 10-year government bond yields for major economies.
   Primary:  Stooq.com daily CSV (free, no key — symbols: 10usd.b, 10gbp.b …)
   Fallback: Yahoo Finance v8/chart for individual symbols
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// stooq: currency-keyed bond symbol on stooq.com
// yahoo: fallback symbol for Yahoo Finance v8/chart
const BONDS = [
  { key: 'us',  label: 'United States', flag: '🇺🇸', stooq: '10usd.b',  yahoo: '^TNX'      },
  { key: 'gb',  label: 'United Kingdom',flag: '🇬🇧', stooq: '10gbp.b',  yahoo: 'GB10YT=RR' },
  { key: 'jp',  label: 'Japan',         flag: '🇯🇵', stooq: '10jpy.b',  yahoo: 'JP10YT=RR' },
  { key: 'de',  label: 'Germany',       flag: '🇩🇪', stooq: '10eur.b',  yahoo: 'DE10YT=RR' },
  { key: 'au',  label: 'Australia',     flag: '🇦🇺', stooq: '10aud.b',  yahoo: 'AU10YT=RR' },
  { key: 'ca',  label: 'Canada',        flag: '🇨🇦', stooq: '10cad.b',  yahoo: 'CA10YT=RR' },
  { key: 'kr',  label: 'South Korea',   flag: '🇰🇷', stooq: '10krw.b',  yahoo: 'KR10YT=RR' },
  { key: 'in',  label: 'India',         flag: '🇮🇳', stooq: '10inr.b',  yahoo: 'IN10YT=RR' },
  { key: 'fr',  label: 'France',        flag: '🇫🇷', stooq: 'oat10y.b', yahoo: 'FR10YT=RR' },
  { key: 'th',  label: 'Thailand',      flag: '🇹🇭', stooq: '10thb.b',  yahoo: null        },
];

// Fetch last ~14 days of daily data from Stooq and return latest value + day change.
// CSV format: Date,Open,High,Low,Close,Volume (no header row when using /q/d/l/)
async function stooqFetch(symbol) {
  const end   = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 14);
  const d1 = start.toISOString().slice(0, 10).replace(/-/g, '');
  const d2 = end.toISOString().slice(0, 10).replace(/-/g, '');

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${d1}&d2=${d2}&i=d`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text || text.includes('No data') || text.trim().length < 10) return null;

    // Skip header line (Date,Open,High,Low,Close,Volume) and blank lines
    const rows = text.trim().split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('Date') && !l.startsWith('Symbol'));

    if (rows.length === 0) return null;

    const parse = row => {
      const cols = row.split(',');
      const v = parseFloat(cols[4]); // Close
      return isNaN(v) || v <= 0 ? null : v;
    };

    const latest = parse(rows[rows.length - 1]);
    if (latest == null) return null;
    const prev = rows.length >= 2 ? parse(rows[rows.length - 2]) : null;

    const change    = prev != null ? +(latest - prev).toFixed(4)                           : null;
    const changePct = prev != null && prev !== 0 ? +((latest - prev) / prev * 100).toFixed(3) : null;
    return { value: +latest.toFixed(4), change, changePct };
  } catch (_) {
    return null;
  }
}

// Yahoo Finance v8/chart fallback (works for ^TNX and some =RR symbols)
async function yahooChartFetch(symbol) {
  if (!symbol) return null;
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      const price = meta.regularMarketPrice ?? null;
      const prev  = meta.chartPreviousClose ?? meta.previousClose ?? null;
      if (price == null) continue;
      const change    = prev != null ? +(price - prev).toFixed(4) : null;
      const changePct = prev != null && prev !== 0 ? +((price - prev) / prev * 100).toFixed(3) : null;
      return { value: +price.toFixed(4), change, changePct };
    } catch (_) { /* try next host */ }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const results = await Promise.all(
    BONDS.map(async b => {
      // Primary: Stooq
      let q = await stooqFetch(b.stooq);
      // Fallback: Yahoo Finance chart
      if (!q || q.value == null) q = await yahooChartFetch(b.yahoo);
      return {
        key: b.key, label: b.label, flag: b.flag,
        value:     q?.value     ?? null,
        change:    q?.change    ?? null,
        changePct: q?.changePct ?? null,
      };
    })
  );

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  return res.status(200).json({ bonds: results, updatedAt: new Date().toISOString() });
}
