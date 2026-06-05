/* ============================================================================
   api/macro.js — Vercel Serverless Function
   GET /api/macro
   Returns live macro indicators: US10Y, VIX, DXY from Yahoo Finance,
   and Fed Rate + CPI from FRED API (requires FRED_API_KEY env var).
   Includes a static market impact matrix from the macro-dashboard template.
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const IMPACT_MATRIX = [
  { indicator: 'Fed Rate ↑', impacts: ['Tech ↓↓↓', 'Gold ↓',     'BTC ↓↓↓', 'USD ↑'   ] },
  { indicator: 'US10Y ↑',   impacts: ['Tech ↓↓↓', 'REIT ↓↓↓',  'Gold ↓',   'USD ↑'   ] },
  { indicator: 'CPI ↑',     impacts: ['Growth ↓',  'Energy ↑↑', 'Gold ↑',   'Mixed'   ] },
  { indicator: 'DXY ↑',     impacts: ['EM ↓↓↓',   'Gold ↓',    'BTC ↓↓',   'USD ↑'   ] },
  { indicator: 'VIX ↑',     impacts: ['Stocks ↓↓↓','Bonds ↑',  'Cash ↑',   'Risk Off'] },
  { indicator: 'M2 ↑',      impacts: ['Stocks ↑↑', 'BTC ↑↑↑',  'Gold ↑',   'Risk On' ] },
];

async function yahooQuote(symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      const price  = meta.regularMarketPrice ?? null;
      const prev   = meta.chartPreviousClose ?? meta.previousClose ?? null;
      const change = price != null && prev != null ? +((price - prev) / prev * 100).toFixed(3) : null;
      return { value: price != null ? +price.toFixed(4) : null, change };
    } catch (_) { /* try next host */ }
  }
  return { value: null, change: null };
}

async function fredLatest(seriesId, apiKey) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const val = j?.observations?.find(o => o.value !== '.')?.value;
    return val != null ? +parseFloat(val).toFixed(4) : null;
  } catch (_) { return null; }
}

async function fredCpiYoY(apiKey) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=18`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const obs = (j?.observations || []).filter(o => o.value !== '.').map(o => parseFloat(o.value));
    if (obs.length < 13) return null;
    return +((obs[0] - obs[12]) / obs[12] * 100).toFixed(2);
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const fredKey = process.env.FRED_API_KEY;

  const [us10y, vix, dxy, fedRate, cpi] = await Promise.all([
    yahooQuote('^TNX'),
    yahooQuote('^VIX'),
    yahooQuote('DX-Y.NYB'),
    fredKey ? fredLatest('FEDFUNDS', fredKey).then(v => ({ value: v, change: null })) : Promise.resolve({ value: null, change: null }),
    fredKey ? fredCpiYoY(fredKey).then(v => ({ value: v, change: null }))            : Promise.resolve({ value: null, change: null }),
  ]);

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  return res.status(200).json({
    indicators: {
      fedRate: { value: fedRate.value, unit: '%',      label: 'Fed Rate',  source: fredKey ? 'FRED' : null },
      us10y:   { value: us10y.value,   unit: '%',      label: 'US 10Y',    change: us10y.change,  source: 'Yahoo' },
      cpi:     { value: cpi.value,     unit: '% YoY',  label: 'CPI',       source: fredKey ? 'FRED' : null },
      vix:     { value: vix.value,     unit: '',       label: 'VIX',       change: vix.change,    source: 'Yahoo' },
      dxy:     { value: dxy.value,     unit: '',       label: 'DXY',       change: dxy.change,    source: 'Yahoo' },
    },
    impactMatrix: IMPACT_MATRIX,
  });
}
