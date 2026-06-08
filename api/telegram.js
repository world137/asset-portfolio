/* ============================================================================
   api/telegram.js — Send daily portfolio report to Telegram

   Called automatically by Vercel cron at 00:00 UTC (= 07:00 AM Thailand).
   Also accepts POST /api/telegram { manual: true } for on-demand sends.

   Required env vars:
     TELEGRAM_BOT_TOKEN   — BotFather token
     TELEGRAM_CHAT_ID     — your personal chat ID or channel ID
     PORTFOLIO_ID         — your portfolio sync ID (from sidebar footer)
     SUPABASE_URL         — Supabase project URL
     SUPABASE_SERVICE_KEY — Supabase service_role key
   ============================================================================ */

import { readBody } from './_lib.js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID       = process.env.TELEGRAM_CHAT_ID;
const PORTFOLIO_ID  = process.env.PORTFOLIO_ID;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Asset classes included in the report
const REPORT_CLASSES = [
  { key: 'crypto',    label: 'Crypto', short: 'Crypto', live: 'crypto', ccy: 'THB' },
  { key: 'usaStock',  label: 'USA',    short: 'USA',    live: 'yahoo',  ccy: 'USD' },
  { key: 'etf',       label: 'ETF',    short: 'ETF',    live: 'yahoo',  ccy: 'USD' },
  { key: 'thaiStock', label: 'Thai',   short: 'Thai',   live: 'yahoo',  ccy: 'THB', yahooSuffix: '.BK' },
  { key: 'gold',      label: 'Gold',   short: 'Gold',   live: 'yahoo',  ccy: 'USD', yahooSymbol: 'GC=F' },
];

// CoinGecko ID mapping (mirrors seed.js CRYPTO_MAP)
const CRYPTO_MAP = {
  BTC:    'bitcoin',      ETH:    'ethereum',     BNB:    'binancecoin',
  SOL:    'solana',       XRP:    'ripple',        USDT:   'tether',
  USDC:   'usd-coin',     ADA:    'cardano',       DOGE:   'dogecoin',
  DOT:    'polkadot',     AVAX:   'avalanche-2',   LINK:   'chainlink',
  LTC:    'litecoin',     MATIC:  'matic-network',
  BTCTHB: 'bitcoin',      ETHTHB: 'ethereum',
};

// ── Price fetchers ─────────────────────────────────────────────────────────────

async function yahooPrice(symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta) { lastErr = new Error('no meta'); continue; }
      const price     = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      return { price, prevClose };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('yahoo failed: ' + symbol);
}

async function cryptoDayChanges(ids) {
  const uniq = [...new Set(ids)].join(',');
  const url  = `https://api.coingecko.com/api/v3/simple/price?ids=${uniq}&vs_currencies=thb&include_24hr_change=true`;
  const r    = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('CoinGecko HTTP ' + r.status);
  return r.json();
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function loadHoldings(portfolioId) {
  const uid = encodeURIComponent(portfolioId);
  const r   = await fetch(
    `${SUPABASE_URL}/rest/v1/holdings?user_id=eq.${uid}&select=class_key,name`,
    { headers: sbHeaders() },
  );
  if (!r.ok) throw new Error('Supabase holdings error: ' + r.status);
  return r.json();
}

async function loadPortfolioData(portfolioId) {
  const uid = encodeURIComponent(portfolioId);
  const r   = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolio_data?user_id=eq.${uid}&select=data&limit=1`,
    { headers: sbHeaders() },
  );
  if (!r.ok) return null;
  const rows = await r.json();
  if (!rows || !rows[0] || !rows[0].data) return null;
  try { return JSON.parse(rows[0].data); } catch (_) { return null; }
}

// ── Price alert checker ────────────────────────────────────────────────────────

function checkPriceAlerts(priceAlerts, assetData) {
  if (!priceAlerts || !priceAlerts.length) return [];
  const triggered = [];
  for (const alert of priceAlerts) {
    if (alert.triggered) continue;
    const key  = `${alert.classKey}:${alert.name}`;
    const data = assetData[key];
    if (!data || data.price == null) continue;
    const hit = alert.condition === 'above'
      ? data.price >= alert.price
      : data.price <= alert.price;
    if (hit) {
      triggered.push({ alert, price: data.price });
    }
  }
  return triggered;
}

// ── Rebalancing drift checker ──────────────────────────────────────────────────

function checkRebalancingDrift(portfolioData, assetData) {
  if (!portfolioData) return [];
  const targetAlloc = portfolioData.targetAllocation || {};
  const holdings    = portfolioData.holdings || {};
  if (!Object.keys(targetAlloc).some(k => (targetAlloc[k] || 0) > 0)) return [];

  const ASSET_CLASSES = [
    { key: 'thaiStock', ccy: 'THB' }, { key: 'usaStock', ccy: 'USD' },
    { key: 'etf', ccy: 'USD' },       { key: 'fund', ccy: 'THB' },
    { key: 'crypto', ccy: 'THB' },    { key: 'gold', ccy: 'USD' },
    { key: 'other', ccy: 'THB' },
  ];
  const USDTHB = portfolioData.fx?.USDTHB || 34.5;

  let totalValue = 0;
  const classValues = {};
  for (const cls of ASSET_CLASSES) {
    let v = 0;
    for (const lot of (holdings[cls.key] || [])) {
      const cur   = lot.cur != null ? lot.cur : lot.price;
      const val   = cur * lot.qty;
      const inTHB = cls.ccy === 'USD' ? val * USDTHB : val;
      v += inTHB;
    }
    classValues[cls.key] = v;
    totalValue += v;
  }

  if (totalValue === 0) return [];
  const alerts = [];
  for (const [key, tgt] of Object.entries(targetAlloc)) {
    if (!tgt) continue;
    const curPct  = (classValues[key] || 0) / totalValue * 100;
    const drift   = curPct - tgt;
    if (Math.abs(drift) >= 5) {
      alerts.push({ key, tgt, curPct, drift });
    }
  }
  return alerts;
}

// ── Report builder ─────────────────────────────────────────────────────────────

async function buildReport(holdings) {
  // Group holdings by class
  const byClass = {};
  for (const h of holdings) {
    (byClass[h.class_key] ||= new Set()).add(h.name);
  }

  // "classKey:name" → { pct, price, changeAbs, ccy, classShort }
  const assetData = {};
  const tasks = [];

  for (const rc of REPORT_CLASSES) {
    const names = [...(byClass[rc.key] || [])];
    if (!names.length) continue;

    if (rc.live === 'crypto') {
      const mapped = names
        .map(n => ({ name: n, id: CRYPTO_MAP[n] }))
        .filter(x => x.id);

      if (mapped.length) {
        tasks.push(
          cryptoDayChanges(mapped.map(x => x.id))
            .then(data => {
              for (const { name, id } of mapped) {
                const entry = data[id];
                if (entry?.thb != null && entry?.thb_24h_change != null) {
                  const price    = entry.thb;
                  const pct      = entry.thb_24h_change;
                  const prevClose = price / (1 + pct / 100);
                  assetData[`${rc.key}:${name}`] = {
                    pct, price, changeAbs: price - prevClose,
                    ccy: rc.ccy, classShort: rc.short,
                  };
                }
              }
            })
            .catch(() => {}),
        );
      }
    } else {
      for (const name of names) {
        const symbol = rc.yahooSymbol || (name + (rc.yahooSuffix || ''));
        tasks.push(
          yahooPrice(symbol)
            .then(({ price, prevClose }) => {
              if (price != null && prevClose != null && prevClose > 0) {
                assetData[`${rc.key}:${name}`] = {
                  pct: ((price - prevClose) / prevClose) * 100,
                  price, changeAbs: price - prevClose,
                  ccy: rc.ccy, classShort: rc.short,
                };
              }
            })
            .catch(() => {}),
        );
      }
    }
  }

  await Promise.allSettled(tasks);

  // Assemble report groups (still used for hasData check)
  const groups = [];
  for (const rc of REPORT_CLASSES) {
    const names = [...(byClass[rc.key] || [])];
    if (!names.length) continue;

    const assets = names
      .map(n => {
        const d = assetData[`${rc.key}:${n}`];
        return d ? { name: n.replace(/THB$/, ''), rawName: n, ...d } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct);

    if (!assets.length) continue;
    groups.push({ label: rc.label, assets });
  }

  return groups;
}

function todayTH() {
  const now    = new Date();
  const local  = new Date(now.getTime() + 7 * 60 * 60000);
  const [y, m, d] = local.toISOString().slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtChangeAbs(v, ccy) {
  const sym = ccy === 'USD' ? '$' : '฿'; // ฿
  const abs = Math.abs(v);
  let s;
  if (abs >= 100000) s = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  else if (abs >= 1000) s = abs.toFixed(0);
  else if (abs >= 10)   s = abs.toFixed(2);
  else if (abs >= 0.01) s = abs.toFixed(4);
  else                  s = abs.toFixed(6);
  return (v >= 0 ? '+' : '-') + sym + s;
}

function formatMessage(groups) {
  let msg = `Report [${todayTH()}]\n`;
  for (const g of groups) {
    msg += `${g.label} :\n`;
    if (g.assets.length === 1) {
      const a    = g.assets[0];
      const sign = a.pct >= 0 ? '+' : '';
      msg += `${a.name} (${sign}${a.pct.toFixed(2)}%)\n`;
    } else {
      const best  = g.assets[0];
      const worst = g.assets[g.assets.length - 1];
      msg += `Best : ${best.name} (${best.pct >= 0 ? '+' : ''}${best.pct.toFixed(2)}%)\n`;
      msg += `Worst : ${worst.name} (${worst.pct >= 0 ? '+' : ''}${worst.pct.toFixed(2)}%)\n`;
    }
    msg += `——————————————————\n`;
  }

  const rows = groups.flatMap(g =>
    g.assets.map(a => ({ ...a, classShort: a.classShort || g.label }))
  ).sort((a, b) => b.pct - a.pct);

  if (!rows.length) return `Report [${todayTH()}]\nNo data.`;

  const fmt = rows.map(r => ({
    name: r.name,
    cls:  r.classShort,
    pct:  (r.pct >= 0 ? '+' : '') + r.pct.toFixed(2) + '%',
    chg:  r.changeAbs != null ? fmtChangeAbs(r.changeAbs, r.ccy) : '—',
  }));

  const pad  = (s, n) => String(s).padEnd(n);
  const padR = (s, n) => String(s).padStart(n);

  const nW = Math.max(5, ...fmt.map(r => r.name.length));
  const cW = Math.max(5, ...fmt.map(r => r.cls.length));
  const pW = Math.max(4, ...fmt.map(r => r.pct.length));
  const gW = Math.max(6, ...fmt.map(r => r.chg.length));

  const header = `${pad('Asset', nW)}  ${pad('Class', cW)}  ${padR('Day%', pW)}  ${padR('Change', gW)}`;
  const sep    = '─'.repeat(header.length);
  const body   = fmt.map(r =>
    `${pad(r.name, nW)}  ${pad(r.cls, cW)}  ${padR(r.pct, pW)}  ${padR(r.chg, gW)}`
  ).join('\n');

  const table = escHtml(`${header}\n${sep}\n${body}`);
  return msg + `\n<pre>${table}</pre>`;
}

async function sendTelegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
  if (!r.ok) throw new Error('Telegram API error: ' + r.status);
  return r.json();
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!BOT_TOKEN) return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  if (!CHAT_ID)   return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(400).json({ error: 'Supabase not configured' });

  // Manual POST from browser sends portfolioId in body; cron GET uses env var.
  let pid = PORTFOLIO_ID;
  if (req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body && body.portfolioId) pid = body.portfolioId;
    } catch (_) {}
  }

  if (!pid) return res.status(400).json({ error: 'PORTFOLIO_ID not configured — set it in Vercel env vars or check your sync ID' });

  console.log(`[telegram] method=${req.method} pid=${pid?.slice(0, 8)}…`);

  try {
    const [holdings, portfolioData] = await Promise.all([
      loadHoldings(pid),
      loadPortfolioData(pid),
    ]);
    console.log(`[telegram] holdings found: ${holdings.length}`);
    if (!holdings.length) return res.status(200).json({ ok: true, note: 'no holdings found for this portfolio ID' });

    const groups = await buildReport(holdings);

    // Rebuild assetData map for alert checking
    const assetDataMap = {};
    for (const g of groups) {
      for (const a of g.assets) {
        assetDataMap[`${g._key || ''}:${a.rawName || a.name}`] = { price: a.price, changeAbs: a.changeAbs, ccy: a.ccy };
      }
    }

    // Check price alerts
    const priceAlerts = portfolioData?.priceAlerts || [];
    const triggeredAlerts = checkPriceAlerts(priceAlerts, assetDataMap);

    // Check rebalancing drift
    const rebalAlerts = checkRebalancingDrift(portfolioData, assetDataMap);

    if (!groups.length && !triggeredAlerts.length && !rebalAlerts.length) {
      return res.status(200).json({ ok: true, note: 'no live price data available yet' });
    }

    let message = groups.length ? formatMessage(groups) : `Report [${todayTH()}]\nNo market data available.\n`;

    // Append price alert section
    if (triggeredAlerts.length > 0) {
      message += '\n🚨 <b>Price Alerts Triggered</b>\n';
      for (const { alert, price } of triggeredAlerts) {
        const dir = alert.condition === 'above' ? '▲ above' : '▼ below';
        message += `• ${escHtml(alert.name.replace(/THB$/, ''))} — ${dir} ${price.toLocaleString()} (target: ${alert.price.toLocaleString()})\n`;
        if (alert.note) message += `  ${escHtml(alert.note)}\n`;
      }
    }

    // Append rebalancing drift section
    if (rebalAlerts.length > 0) {
      message += '\n⚖️ <b>Rebalancing Needed (&gt;5% drift)</b>\n';
      const CLASS_LABELS = { thaiStock: 'Thai Stock', usaStock: 'USA Stock', etf: 'ETF', fund: 'Fund', crypto: 'Crypto', gold: 'Gold', other: 'Other' };
      for (const a of rebalAlerts) {
        const direction = a.drift > 0 ? `overweight +${a.drift.toFixed(1)}%` : `underweight ${a.drift.toFixed(1)}%`;
        message += `• ${escHtml(CLASS_LABELS[a.key] || a.key)}: ${a.curPct.toFixed(1)}% vs target ${a.tgt}% (${direction})\n`;
      }
    }

    await sendTelegram(message);
    console.log('[telegram] sent ok');
    return res.status(200).json({ ok: true, message, triggeredAlerts: triggeredAlerts.length, rebalAlerts: rebalAlerts.length });
  } catch (e) {
    console.error('[telegram] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
