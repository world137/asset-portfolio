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
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID       = process.env.TELEGRAM_CHAT_ID;
const PORTFOLIO_ID  = process.env.PORTFOLIO_ID;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Asset classes included in the report
const REPORT_CLASSES = [
  { key: 'crypto',    label: 'Crypto',    live: 'crypto' },
  { key: 'usaStock',  label: 'USA',       live: 'yahoo' },
  { key: 'etf',       label: 'ETF',       live: 'yahoo' },
  { key: 'thaiStock', label: 'Thai',      live: 'yahoo', yahooSuffix: '.BK' },
  { key: 'gold',      label: 'Gold',      live: 'yahoo', yahooSymbol: 'GC=F' },
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

// ── Report builder ─────────────────────────────────────────────────────────────

async function buildReport(holdings) {
  // Group holdings by class
  const byClass = {};
  for (const h of holdings) {
    (byClass[h.class_key] ||= new Set()).add(h.name);
  }

  const dayChanges = {}; // "classKey:name" → pct
  const tasks = [];

  for (const rc of REPORT_CLASSES) {
    const names = [...(byClass[rc.key] || [])];
    if (!names.length) continue;

    if (rc.live === 'crypto') {
      // Batch all crypto IDs in one CoinGecko call
      const mapped = names
        .map(n => ({ name: n, id: CRYPTO_MAP[n] }))
        .filter(x => x.id);

      if (mapped.length) {
        tasks.push(
          cryptoDayChanges(mapped.map(x => x.id))
            .then(data => {
              for (const { name, id } of mapped) {
                const entry = data[id];
                if (entry?.thb_24h_change != null) {
                  dayChanges[`${rc.key}:${name}`] = entry.thb_24h_change;
                }
              }
            })
            .catch(() => {}),
        );
      }
    } else {
      // Yahoo Finance — one request per unique symbol
      for (const name of names) {
        const symbol = rc.yahooSymbol || (name + (rc.yahooSuffix || ''));
        tasks.push(
          yahooPrice(symbol)
            .then(({ price, prevClose }) => {
              if (price != null && prevClose != null && prevClose > 0) {
                dayChanges[`${rc.key}:${name}`] = ((price - prevClose) / prevClose) * 100;
              }
            })
            .catch(() => {}),
        );
      }
    }
  }

  await Promise.allSettled(tasks);

  // Assemble report groups
  const groups = [];
  for (const rc of REPORT_CLASSES) {
    const names = [...(byClass[rc.key] || [])];
    if (!names.length) continue;

    const assets = names
      .map(n => ({ name: n.replace(/THB$/, ''), rawName: n, pct: dayChanges[`${rc.key}:${n}`] }))
      .filter(a => a.pct != null)
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
  return msg;
}

async function sendTelegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID, text }),
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

  if (!BOT_TOKEN)    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  if (!CHAT_ID)      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
  if (!PORTFOLIO_ID) return res.status(400).json({ error: 'PORTFOLIO_ID not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(400).json({ error: 'Supabase not configured' });

  try {
    const holdings = await loadHoldings(PORTFOLIO_ID);
    if (!holdings.length) return res.status(200).json({ ok: true, note: 'no holdings' });

    const groups = await buildReport(holdings);
    if (!groups.length) {
      return res.status(200).json({ ok: true, note: 'no live price data available' });
    }

    const message = formatMessage(groups);
    await sendTelegram(message);
    return res.status(200).json({ ok: true, message });
  } catch (e) {
    console.error('telegram error:', e);
    return res.status(500).json({ error: e.message });
  }
}
