/* ============================================================================
   api/chart.js — Historical price chart data from Yahoo Finance
   GET ?symbol=AAPL&range=1mo
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const INTERVAL_MAP = {
  '1d':  '5m',
  '5d':  '30m',
  '1mo': '1d',
  '3mo': '1d',
  '6mo': '1wk',
  '1y':  '1wk',
  '2y':  '1d',
  '5y':  '1mo',
  'ytd': '1d',
  'max': '3mo',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { symbol, range = '1mo', format } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const isBars = format === 'bars';

  const interval = INTERVAL_MAP[range] || '1d';
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;

  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = new Error('No data'); continue; }

      const meta = result.meta || {};
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};

      const points = timestamps.map((t, i) => ({
        t: t * 1000,
        o: quote.open?.[i] ?? null,
        h: quote.high?.[i] ?? null,
        l: quote.low?.[i] ?? null,
        c: quote.close?.[i] ?? null,
      })).filter(p => p.c != null);

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

      if (isBars) {
        // bars format for technical analysis — t in seconds, includes volume
        const bars = timestamps.map((t, i) => ({
          t,
          o: quote.open?.[i]   ?? null,
          h: quote.high?.[i]   ?? null,
          l: quote.low?.[i]    ?? null,
          c: quote.close?.[i]  ?? null,
          v: quote.volume?.[i] ?? null,
        })).filter(b => b.c != null && b.h != null && b.l != null);
        return res.status(200).json({
          bars,
          currency: meta.currency || 'USD',
          symbol:   meta.symbol   || symbol,
          name:     meta.shortName || meta.longName || symbol,
        });
      }

      return res.status(200).json({
        symbol,
        currency: meta.currency || 'USD',
        price: meta.regularMarketPrice ?? points[points.length - 1]?.c ?? null,
        prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
        points,
      });
    } catch (e) {
      lastErr = e;
    }
  }

  return res.status(500).json({ error: lastErr?.message || 'Failed to fetch chart data' });
}
