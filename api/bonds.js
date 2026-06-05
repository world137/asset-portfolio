/* ============================================================================
   api/bonds.js — Vercel Serverless Function
   GET /api/bonds
   Returns 10-year government bond yields for major economies.
   Data sourced from Yahoo Finance (15-minute cache).
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BONDS = [
  { key: 'us',  label: 'United States', flag: '🇺🇸', symbol: '^TNX'       },
  { key: 'gb',  label: 'United Kingdom',flag: '🇬🇧', symbol: 'GB10YT=RR'  },
  { key: 'jp',  label: 'Japan',         flag: '🇯🇵', symbol: 'JP10YT=RR'  },
  { key: 'de',  label: 'Germany',       flag: '🇩🇪', symbol: 'DE10YT=RR'  },
  { key: 'au',  label: 'Australia',     flag: '🇦🇺', symbol: 'AU10YT=RR'  },
  { key: 'ca',  label: 'Canada',        flag: '🇨🇦', symbol: 'CA10YT=RR'  },
  { key: 'ru',  label: 'Russia',        flag: '🇷🇺', symbol: 'RU10YT=RR'  },
  { key: 'kr',  label: 'South Korea',   flag: '🇰🇷', symbol: 'KR10YT=RR'  },
  { key: 'in',  label: 'India',         flag: '🇮🇳', symbol: 'IN10YT=RR'  },
  { key: 'fr',  label: 'France',        flag: '🇫🇷', symbol: 'FR10YT=RR'  },
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
      const change = price != null && prev != null ? +((price - prev)).toFixed(4) : null;
      const changePct = price != null && prev != null && prev !== 0 ? +((price - prev) / prev * 100).toFixed(3) : null;
      return { value: price != null ? +price.toFixed(4) : null, change, changePct };
    } catch (_) { /* try next host */ }
  }
  return { value: null, change: null, changePct: null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const results = await Promise.all(
    BONDS.map(b => yahooQuote(b.symbol).then(q => ({
      key: b.key, label: b.label, flag: b.flag,
      value: q.value, change: q.change, changePct: q.changePct,
    })))
  );

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  return res.status(200).json({ bonds: results, updatedAt: new Date().toISOString() });
}
