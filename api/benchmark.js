/* api/benchmark.js — Fetch benchmark index data via Yahoo Finance */
const { readBody } = require('./_lib');

const BENCHMARKS = {
  set:   { symbol: '^SET.BK',   label: 'SET (Thailand)' },
  sp500: { symbol: '^GSPC',     label: 'S&P 500' },
  ndx:   { symbol: '^NDX',      label: 'NASDAQ-100' },
  dji:   { symbol: '^DJI',      label: 'Dow Jones' },
  msci:  { symbol: 'URTH',      label: 'MSCI World ETF' },
};

async function fetchYahooRange(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const j = await res.json();
  const result = j?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);
  const ts     = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return ts.map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] }))
           .filter(p => p.close != null);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const range    = req.query?.range || '1y';
  const keys     = (req.query?.symbols || 'set,sp500').split(',').map(s => s.trim());

  const VALID_RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y', 'max'];
  if (!VALID_RANGES.includes(range)) {
    res.status(400).json({ error: 'invalid range' }); return;
  }

  const interval = ['1mo', '3mo', '6mo'].includes(range) ? '1d' : '1wk';
  const results  = {};
  const errors   = [];

  await Promise.all(keys.map(async key => {
    const bm = BENCHMARKS[key];
    if (!bm) { errors.push(`unknown: ${key}`); return; }
    try {
      const points = await fetchYahooRange(bm.symbol, range, interval);
      results[key] = { label: bm.label, symbol: bm.symbol, points };
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
    }
  }));

  res.status(200).json({ benchmarks: results, errors });
};
