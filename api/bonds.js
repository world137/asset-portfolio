/* ============================================================================
   api/bonds.js — Vercel Serverless Function
   GET /api/bonds

   Multi-source 10-year government bond yields.
   Yahoo Finance now blocks all server-side requests (429 globally).

   Sources used (all free, no API key):
   - US:      US Department of the Treasury (XML)
   - UK:      Bank of England Statistics API (series IUDMNPY)
   - Germany: ECB Euro Area Yield Curve (sovereign benchmark)
   - Japan:   Japan Ministry of Finance CSV
   - Canada:  Bank of Canada Valet API
   ============================================================================ */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Shared helper ─────────────────────────────────────────────────────────────

function makeResult(latest, prev) {
  const value     = +latest.toFixed(4);
  const change    = prev != null ? +(latest - prev).toFixed(4)                            : null;
  const changePct = prev != null && prev !== 0 ? +((latest - prev) / prev * 100).toFixed(3) : null;
  return { value, change, changePct };
}

// ── Fetcher: US Treasury XML ──────────────────────────────────────────────────
// Endpoint: daily_treasury_yield_curve, field BC_10YEAR

async function fetchUSTreasury() {
  const now = new Date();
  for (let offset = 0; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    try {
      // NOTE: Treasury returns XML only when User-Agent is absent; browser UA triggers HTML redirect.
      const r = await fetch(
        `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${ym}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!r.ok) continue;
      const text = await r.text();
      const vals = [...text.matchAll(/BC_10YEAR[^>]*>([0-9.]+)</g)]
        .map(m => parseFloat(m[1])).filter(v => !isNaN(v));
      if (vals.length > 0) {
        return makeResult(vals[vals.length - 1], vals.length >= 2 ? vals[vals.length - 2] : null);
      }
    } catch (_) {}
  }
  return null;
}

// ── Fetcher: Bank of England ──────────────────────────────────────────────────
// Series IUDMNPY: Daily nominal par yield, 10-year UK Gilt

async function fetchBOE() {
  const end   = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 60); // 60 days back ensures data even across month boundaries

  const fmtBOE = d => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${dd}/${mon}/${d.getFullYear()}`;
  };

  try {
    const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp?csv.x=yes&Datefrom=${fmtBOE(start)}&Dateto=${fmtBOE(end)}&SeriesCodes=IUDMNPY&CSVF=TT&UsingCodes=Y`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const text = await r.text();
    // Rows start with "dd Mon yyyy," — skip header/description lines
    const vals = text.split('\n')
      .filter(l => /^\d{2} \w+ \d{4}/.test(l))
      .map(l => parseFloat(l.split(',')[1]))
      .filter(v => !isNaN(v));
    if (!vals.length) return null;
    return makeResult(vals[vals.length - 1], vals.length >= 2 ? vals[vals.length - 2] : null);
  } catch (_) {
    return null;
  }
}

// ── Fetcher: ECB Euro Area Yield Curve ────────────────────────────────────────
// Spot 10Y yield of AAA-rated Euro area government bonds (sovereign benchmark)

async function fetchECB() {
  try {
    const r = await fetch(
      'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?lastNObservations=3&format=jsondata',
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const obs = j?.dataSets?.[0]?.series?.['0:0:0:0:0:0:0']?.observations;
    if (!obs) return null;
    const keys = Object.keys(obs).sort((a, b) => +a - +b);
    const latest = obs[keys[keys.length - 1]]?.[0];
    const prev   = keys.length >= 2 ? obs[keys[keys.length - 2]]?.[0] : null;
    if (latest == null) return null;
    return makeResult(latest, prev ?? null);
  } catch (_) {
    return null;
  }
}

// ── Fetcher: Japan Ministry of Finance ───────────────────────────────────────
// jgbcme.csv — columns: Date,1Y,2Y,...,10Y (index 10),15Y,...

async function fetchMOF() {
  try {
    const r = await fetch(
      'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const text = await r.text();
    const vals = text.split('\n')
      .filter(l => /^\d{4}\/\d{1,2}\/\d{1,2}/.test(l))
      .map(l => parseFloat(l.split(',')[10]))   // col 10 = 10Y
      .filter(v => !isNaN(v));
    if (!vals.length) return null;
    return makeResult(vals[vals.length - 1], vals.length >= 2 ? vals[vals.length - 2] : null);
  } catch (_) {
    return null;
  }
}

// ── Fetcher: FRED / OECD harmonized long-term rates (CSV, no API key) ─────────
// Monthly frequency. Series IDs: IRLTLT01{CC}M156N (OECD MEI dataset via FRED).
// Covers all OECD members + major G20 partners (AU, FR, KR, IN).

async function fetchFRED(seriesId) {
  try {
    const r = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) }
    );
    if (!r.ok) return null;
    const text = await r.text();
    const vals = text.split('\n')
      .filter(l => /^\d{4}-\d{2}-\d{2}/.test(l))
      .map(l => parseFloat(l.split(',')[1]))
      .filter(v => !isNaN(v));
    if (!vals.length) return null;
    return makeResult(vals[vals.length - 1], vals.length >= 2 ? vals[vals.length - 2] : null);
  } catch (_) {
    return null;
  }
}

// ── Fetcher: stooq.com — daily government bond yields ─────────────────────────
// Ticker format: {maturity}y{cc}.b  e.g. 10thy.b = Thailand 10Y

async function fetchStooq(ticker) {
  try {
    const r = await fetch(
      `https://stooq.com/q/d/l/?s=${ticker}&i=d`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) }
    );
    if (!r.ok) return null;
    const text = await r.text();
    // CSV: Date,Open,High,Low,Close,Volume — use Close (col 4)
    const vals = text.split('\n')
      .filter(l => /^\d{4}-\d{2}-\d{2}/.test(l))
      .map(l => parseFloat(l.split(',')[4]))
      .filter(v => !isNaN(v));
    if (!vals.length) return null;
    return makeResult(vals[vals.length - 1], vals.length >= 2 ? vals[vals.length - 2] : null);
  } catch (_) {
    return null;
  }
}

// ── Fetcher: Bank of Canada Valet API ─────────────────────────────────────────
// Series BD.CDN.10YR.DQ.YLD — daily Government of Canada 10Y bond yield

async function fetchBOC() {
  try {
    const r = await fetch(
      'https://www.bankofcanada.ca/valet/observations/BD.CDN.10YR.DQ.YLD/json?recent=10',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const vals = (j.observations || [])
      .map(o => parseFloat(o?.['BD.CDN.10YR.DQ.YLD']?.v))
      .filter(v => !isNaN(v));
    if (!vals.length) return null;
    return makeResult(vals[vals.length - 1], vals.length >= 2 ? vals[vals.length - 2] : null);
  } catch (_) {
    return null;
  }
}

// ── Bond definitions ──────────────────────────────────────────────────────────

const BONDS = [
  { key: 'us', label: 'United States', flag: '🇺🇸', fetch: fetchUSTreasury },
  { key: 'gb', label: 'United Kingdom',flag: '🇬🇧', fetch: fetchBOE        },
  { key: 'de', label: 'Germany',       flag: '🇩🇪', fetch: fetchECB        },  // Euro area sovereign benchmark
  { key: 'jp', label: 'Japan',         flag: '🇯🇵', fetch: fetchMOF        },
  { key: 'ca', label: 'Canada',        flag: '🇨🇦', fetch: fetchBOC        },
  { key: 'kr', label: 'South Korea',   flag: '🇰🇷', fetch: () => fetchFRED('IRLTLT01KRM156N') },
];

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const results = await Promise.all(
    BONDS.map(async b => {
      const q = b.fetch ? await b.fetch() : null;
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
