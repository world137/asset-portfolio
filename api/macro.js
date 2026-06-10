/* ============================================================================
   api/macro.js — Vercel Serverless Function
   GET /api/macro
   Returns live macro indicators from Yahoo Finance and FRED API.
   Requires FRED_API_KEY env var for Fed Rate, CPI, and M2 data.
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
    } catch (_) {}
  }
  return { value: null, change: null };
}

// Fetch a FRED observation. opts is appended to the URL (e.g. '&units=pc1').
// Returns { value, date } where date is the observation date string (YYYY-MM-DD).
async function fredObs(seriesId, apiKey, opts = '') {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=2${opts}`;
    const r = await fetch(url);
    if (!r.ok) return { value: null, date: null };
    const j = await r.json();
    const obs = (j?.observations || []).find(o => o.value !== '.');
    if (!obs) return { value: null, date: null };
    return { value: +parseFloat(obs.value).toFixed(4), date: obs.date };
  } catch (_) { return { value: null, date: null }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const fredKey = process.env.FRED_API_KEY;

  const [us10y, vix, dxy, oil, sp500, gold, usdthb, fedRateObs, cpiObs, m2Obs] = await Promise.all([
    yahooQuote('^TNX'),
    yahooQuote('^VIX'),
    yahooQuote('DX-Y.NYB'),
    yahooQuote('CL=F'),
    yahooQuote('^GSPC'),
    yahooQuote('GC=F'),
    yahooQuote('USDTHB=X'),
    fredKey ? fredObs('FEDFUNDS', fredKey)             : Promise.resolve({ value: null, date: null }),
    fredKey ? fredObs('CPIAUCSL', fredKey, '&units=pc1') : Promise.resolve({ value: null, date: null }),
    fredKey ? fredObs('M2SL',     fredKey, '&units=pc1') : Promise.resolve({ value: null, date: null }),
  ]);

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  return res.status(200).json({
    indicators: {
      fedRate: { value: fedRateObs.value, unit: '%',       label: 'Fed Rate',  date: fedRateObs.date, source: fredKey ? 'FRED' : null },
      us10y:   { value: us10y.value,      unit: '%',       label: 'US 10Y',    change: us10y.change,  source: 'Yahoo' },
      cpi:     { value: cpiObs.value,     unit: '% YoY',   label: 'CPI',       date: cpiObs.date,     source: fredKey ? 'FRED' : null },
      vix:     { value: vix.value,        unit: '',        label: 'VIX',       change: vix.change,    source: 'Yahoo' },
      dxy:     { value: dxy.value,        unit: '',        label: 'DXY',       change: dxy.change,    source: 'Yahoo' },
      oil:     { value: oil.value,        unit: 'USD/bbl', label: 'WTI Oil',   change: oil.change,    source: 'Yahoo' },
      sp500:   { value: sp500.value,      unit: '',        label: 'S&P 500',   change: sp500.change,  source: 'Yahoo' },
      gold:    { value: gold.value,       unit: 'USD/oz',  label: 'Gold',      change: gold.change,   source: 'Yahoo' },
      usdthb:  { value: usdthb.value,     unit: '',        label: 'USD/THB',   change: usdthb.change, source: 'Yahoo' },
      m2:      { value: m2Obs.value,      unit: '% YoY',   label: 'M2 Growth', date: m2Obs.date,      source: fredKey ? 'FRED' : null },
    },
  });
}
