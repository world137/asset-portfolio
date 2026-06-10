/* ============================================================================
   api/telegram.js — Send daily portfolio report to Telegram

   Called automatically by Vercel cron at 06:00 & 18:00 Thailand time.
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

const REPORT_CLASSES = [
  { key: 'crypto',    label: 'Crypto', short: 'Crypto', live: 'crypto', ccy: 'THB' },
  { key: 'usaStock',  label: 'USA',    short: 'USA',    live: 'yahoo',  ccy: 'USD' },
  { key: 'etf',       label: 'ETF',    short: 'ETF',    live: 'yahoo',  ccy: 'USD' },
  { key: 'thaiStock', label: 'Thai',   short: 'Thai',   live: 'yahoo',  ccy: 'THB', yahooSuffix: '.BK' },
  { key: 'gold',      label: 'Gold',   short: 'Gold',   live: 'yahoo',  ccy: 'USD', yahooSymbol: 'GC=F' },
];

const CRYPTO_MAP = {
  BTC:    'bitcoin',      ETH:    'ethereum',     BNB:    'binancecoin',
  SOL:    'solana',       XRP:    'ripple',        USDT:   'tether',
  USDC:   'usd-coin',     ADA:    'cardano',       DOGE:   'dogecoin',
  DOT:    'polkadot',     AVAX:   'avalanche-2',   LINK:   'chainlink',
  LTC:    'litecoin',     MATIC:  'matic-network',
  BTCTHB: 'bitcoin',      ETHTHB: 'ethereum',
};

// ── Supabase helpers ───────────────────────────────────────────────────────────

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sbGet(table, qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`sb-${table}-${r.status}`);
  return r.json();
}

// ── Data loaders ───────────────────────────────────────────────────────────────

async function loadHoldings(portfolioId) {
  const uid = encodeURIComponent(portfolioId);
  return sbGet('holdings', `user_id=eq.${uid}&select=class_key,name,qty`);
}

async function loadPortfolioMeta(portfolioId) {
  const uid = encodeURIComponent(portfolioId);
  try {
    const [fxRows, alertRows, allocRows] = await Promise.all([
      sbGet('fx_rates',          `user_id=eq.${uid}&select=pair,rate`),
      sbGet('price_alerts',      `user_id=eq.${uid}&select=*`),
      sbGet('target_allocation', `user_id=eq.${uid}&select=class_key,target_pct`),
    ]);

    const fx = { USDTHB: 34.5, JPYTHB: 0.23, KRWTHB: 0.026 };
    for (const row of fxRows) {
      if (row.pair === 'USDTHB') fx.USDTHB = parseFloat(row.rate);
      else if (row.pair === 'JPYTHB') fx.JPYTHB = parseFloat(row.rate);
      else if (row.pair === 'KRWTHB') fx.KRWTHB = parseFloat(row.rate);
    }

    const priceAlerts = alertRows.map(r => ({
      id:        r.id,
      classKey:  r.class_key,
      name:      r.name,
      condition: r.condition,
      price:     parseFloat(r.price),
      note:      r.note || '',
      triggered: r.triggered,
    }));

    const targetAllocation = {};
    for (const a of allocRows) targetAllocation[a.class_key] = parseFloat(a.target_pct);

    return { fx, priceAlerts, targetAllocation };
  } catch (e) {
    console.warn('[telegram] loadPortfolioMeta error:', e.message);
    return { fx: { USDTHB: 34.5 }, priceAlerts: [], targetAllocation: {} };
  }
}

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
      return {
        price:     meta.regularMarketPrice,
        prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      };
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

// ── Report builder ─────────────────────────────────────────────────────────────

// Returns { groups, assetData }
// assetData keyed by "classKey:rawName" → { price, prevClose, changeAbs, pct, ccy }
async function buildReport(holdings) {
  const byClass = {};
  for (const h of holdings) {
    (byClass[h.class_key] ||= new Set()).add(h.name);
  }

  const assetData = {};
  const tasks = [];

  for (const rc of REPORT_CLASSES) {
    const names = [...(byClass[rc.key] || [])];
    if (!names.length) continue;

    if (rc.live === 'crypto') {
      const mapped = names.map(n => ({ name: n, id: CRYPTO_MAP[n] })).filter(x => x.id);
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
                    price, prevClose, pct, changeAbs: price - prevClose,
                    ccy: rc.ccy, classShort: rc.short,
                  };
                }
              }
            }).catch(() => {}),
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
                  price, prevClose,
                  pct:       ((price - prevClose) / prevClose) * 100,
                  changeAbs: price - prevClose,
                  ccy:       rc.ccy,
                  classShort: rc.short,
                };
              }
            }).catch(() => {}),
        );
      }
    }
  }

  await Promise.allSettled(tasks);

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
    groups.push({ key: rc.key, label: rc.label, assets });
  }

  return { groups, assetData };
}

// ── Portfolio value calculator ─────────────────────────────────────────────────

function computePortfolioSummary(holdings, assetData, fx) {
  const USDTHB = fx?.USDTHB || 34.5;
  let totalTHB = 0, dayPnlTHB = 0, coveredCount = 0;

  for (const h of holdings) {
    const key = `${h.class_key}:${h.name}`;
    const d   = assetData[key];
    if (!d || d.price == null) continue;
    const qty = parseFloat(h.qty) || 0;
    const mul = d.ccy === 'USD' ? USDTHB : 1;
    totalTHB += qty * d.price * mul;
    if (d.changeAbs != null) dayPnlTHB += qty * d.changeAbs * mul;
    coveredCount++;
  }

  const prevTotal  = totalTHB - dayPnlTHB;
  const dayPnlPct  = prevTotal > 0 ? (dayPnlTHB / prevTotal) * 100 : 0;
  return { totalTHB, dayPnlTHB, dayPnlPct, coveredCount };
}

// ── Checkers ───────────────────────────────────────────────────────────────────

function checkPriceAlerts(priceAlerts, assetData) {
  if (!priceAlerts?.length) return [];
  return priceAlerts
    .filter(a => !a.triggered)
    .flatMap(alert => {
      const key  = `${alert.classKey}:${alert.name}`;
      const d    = assetData[key];
      if (!d || d.price == null) return [];
      const hit  = alert.condition === 'above' ? d.price >= alert.price : d.price <= alert.price;
      return hit ? [{ alert, price: d.price }] : [];
    });
}

function checkRebalancingDrift(targetAllocation, holdings, assetData, fx) {
  if (!targetAllocation || !Object.keys(targetAllocation).some(k => (targetAllocation[k] || 0) > 0)) return [];
  const ASSET_CLASSES = [
    { key: 'thaiStock', ccy: 'THB' }, { key: 'usaStock', ccy: 'USD' },
    { key: 'etf',       ccy: 'USD' }, { key: 'fund',     ccy: 'THB' },
    { key: 'crypto',    ccy: 'THB' }, { key: 'gold',     ccy: 'USD' },
    { key: 'other',     ccy: 'THB' },
  ];
  const USDTHB = fx?.USDTHB || 34.5;

  let totalValue = 0;
  const classValues = {};
  for (const cls of ASSET_CLASSES) {
    let v = 0;
    for (const h of holdings) {
      if (h.class_key !== cls.key) continue;
      const key = `${cls.key}:${h.name}`;
      const d   = assetData[key];
      const price = d?.price ?? null;
      if (price == null) continue;
      const val = parseFloat(h.qty) * price;
      v += cls.ccy === 'USD' ? val * USDTHB : val;
    }
    classValues[cls.key] = v;
    totalValue += v;
  }
  if (totalValue === 0) return [];

  return Object.entries(targetAllocation)
    .filter(([, tgt]) => tgt)
    .flatMap(([key, tgt]) => {
      const curPct = (classValues[key] || 0) / totalValue * 100;
      const drift  = curPct - tgt;
      return Math.abs(drift) >= 5 ? [{ key, tgt, curPct, drift }] : [];
    });
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function todayTH() {
  const local = new Date(new Date().getTime() + 7 * 3600000);
  const [y, m, d] = local.toISOString().slice(0, 10).split('-');
  const h = String(local.getUTCHours()).padStart(2, '0');
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  return { date: `${d}-${m}-${y}`, time: `${h}:${min}` };
}

function fmtBig(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(2);
}

function fmtPrice(v, ccy) {
  const sym = ccy === 'USD' ? '$' : '฿';
  const abs = Math.abs(v);
  let s;
  if (abs >= 1e6)    s = (abs / 1e6).toFixed(2) + 'M';
  else if (abs >= 1000) s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  else if (abs >= 10)   s = abs.toFixed(2);
  else if (abs >= 0.01) s = abs.toFixed(4);
  else                  s = abs.toFixed(6);
  return (v < 0 ? '-' : '') + sym + s;
}

function fmtChange(v, ccy) {
  const sym = ccy === 'USD' ? '$' : '฿';
  const abs = Math.abs(v);
  let s;
  if (abs >= 1000) s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  else if (abs >= 10)   s = abs.toFixed(2);
  else if (abs >= 0.01) s = abs.toFixed(4);
  else                  s = abs.toFixed(6);
  return (v >= 0 ? '+' : '-') + sym + s;
}

function formatMessage(groups, assetData, summary) {
  if (!groups.length) return null;

  const { date, time } = todayTH();
  const pnlSign  = summary.dayPnlTHB >= 0 ? '+' : '';
  const pnlEmoji = summary.dayPnlTHB >= 0 ? '📈' : '📉';

  let msg = `📊 <b>Portfolio Report</b> — ${date} ${time} TH\n`;

  // ── Portfolio summary ─────────────────────────────────────────────────
  if (summary.totalTHB > 0) {
    msg += `\n💰 <b>Total: ฿${fmtBig(summary.totalTHB)}</b>`;
    if (summary.dayPnlTHB !== 0) {
      msg += `   ${pnlEmoji} Day: <b>${pnlSign}฿${fmtBig(Math.abs(summary.dayPnlTHB))} (${pnlSign}${summary.dayPnlPct.toFixed(2)}%)</b>`;
    }
    msg += '\n';
  }

  msg += '\n';

  // ── Best & worst per class ────────────────────────────────────────────
  const classLines = groups.map(g => {
    if (g.assets.length === 1) {
      const a    = g.assets[0];
      const sign = a.pct >= 0 ? '+' : '';
      return `${g.label.padEnd(7)} · ${a.name} ${sign}${a.pct.toFixed(2)}%`;
    }
    const best  = g.assets[0];
    const worst = g.assets[g.assets.length - 1];
    const bs    = best.pct  >= 0 ? '+' : '';
    const ws    = worst.pct >= 0 ? '+' : '';
    return `${g.label.padEnd(7)} · 🏆 ${best.name} ${bs}${best.pct.toFixed(2)}%  /  💀 ${worst.name} ${ws}${worst.pct.toFixed(2)}%`;
  });

  msg += `<pre>${escHtml(classLines.join('\n'))}</pre>\n`;

  // ── All-assets table ──────────────────────────────────────────────────
  const rows = groups.flatMap(g =>
    g.assets.map(a => ({
      name: a.name,
      cls:  a.classShort || g.label,
      pct:  (a.pct >= 0 ? '+' : '') + a.pct.toFixed(2) + '%',
      price: fmtPrice(a.price, a.ccy),
      chg:  a.changeAbs != null ? fmtChange(a.changeAbs, a.ccy) : '—',
    }))
  ).sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));

  if (rows.length) {
    const pad  = (s, n) => String(s).padEnd(n);
    const padR = (s, n) => String(s).padStart(n);
    const nW   = Math.max(5, ...rows.map(r => r.name.length));
    const cW   = Math.max(5, ...rows.map(r => r.cls.length));
    const pW   = Math.max(4, ...rows.map(r => r.pct.length));
    const prW  = Math.max(7, ...rows.map(r => r.price.length));
    const gW   = Math.max(6, ...rows.map(r => r.chg.length));

    const header = `${pad('Asset', nW)}  ${pad('Class', cW)}  ${padR('Day%', pW)}  ${padR('Price', prW)}  ${padR('Change', gW)}`;
    const sep    = '─'.repeat(header.length);
    const body   = rows.map(r =>
      `${pad(r.name, nW)}  ${pad(r.cls, cW)}  ${padR(r.pct, pW)}  ${padR(r.price, prW)}  ${padR(r.chg, gW)}`
    ).join('\n');

    msg += `\n<pre>${escHtml(`${header}\n${sep}\n${body}`)}</pre>`;
  }

  return msg;
}

// ── Telegram sender ────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error('Telegram API error: ' + r.status + ' ' + body);
  }
  return r.json();
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!BOT_TOKEN)                       return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  if (!CHAT_ID)                         return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY)   return res.status(400).json({ error: 'Supabase not configured' });

  let pid = PORTFOLIO_ID;
  if (req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body?.portfolioId) pid = body.portfolioId;
    } catch (_) {}
  }

  if (!pid) return res.status(400).json({ error: 'PORTFOLIO_ID not configured' });

  console.log(`[telegram] method=${req.method} pid=${pid?.slice(0, 8)}…`);

  try {
    const [holdings, meta] = await Promise.all([
      loadHoldings(pid),
      loadPortfolioMeta(pid),
    ]);

    console.log(`[telegram] holdings: ${holdings.length}`);
    if (!holdings.length) return res.status(200).json({ ok: true, note: 'no holdings' });

    const { groups, assetData } = await buildReport(holdings);
    const summary               = computePortfolioSummary(holdings, assetData, meta.fx);
    const triggeredAlerts       = checkPriceAlerts(meta.priceAlerts, assetData);
    const rebalAlerts           = checkRebalancingDrift(meta.targetAllocation, holdings, assetData, meta.fx);

    if (!groups.length && !triggeredAlerts.length && !rebalAlerts.length) {
      return res.status(200).json({ ok: true, note: 'no live price data' });
    }

    const { date, time } = todayTH();
    let message = formatMessage(groups, assetData, summary)
      || `📊 <b>Portfolio Report</b> — ${date} ${time} TH\nNo market data available.\n`;

    // ── Price alert section ──────────────────────────────────────────────
    if (triggeredAlerts.length > 0) {
      message += '\n\n🚨 <b>Price Alerts Triggered</b>\n';
      for (const { alert, price } of triggeredAlerts) {
        const dir    = alert.condition === 'above' ? '▲ above' : '▼ below';
        const target = alert.price.toLocaleString('en', { maximumFractionDigits: 4 });
        message += `• <b>${escHtml(alert.name.replace(/THB$/, ''))}</b> — ${dir} ${escHtml(String(price.toLocaleString()))} (target: ${target})\n`;
        if (alert.note) message += `  <i>${escHtml(alert.note)}</i>\n`;
      }
    }

    // ── Rebalancing drift section ────────────────────────────────────────
    if (rebalAlerts.length > 0) {
      message += '\n\n⚖️ <b>Rebalancing Needed (&gt;5% drift)</b>\n';
      const LABELS = { thaiStock: 'Thai Stock', usaStock: 'USA Stock', etf: 'ETF', fund: 'Fund', crypto: 'Crypto', gold: 'Gold', other: 'Other' };
      for (const a of rebalAlerts) {
        const dir = a.drift > 0 ? `overweight +${a.drift.toFixed(1)}%` : `underweight ${a.drift.toFixed(1)}%`;
        message += `• ${escHtml(LABELS[a.key] || a.key)}: ${a.curPct.toFixed(1)}% vs target ${a.tgt}% (${dir})\n`;
      }
    }

    await sendTelegram(message);
    console.log('[telegram] sent ok');
    return res.status(200).json({
      ok: true,
      summary: { totalTHB: Math.round(summary.totalTHB), dayPnlTHB: Math.round(summary.dayPnlTHB), dayPnlPct: summary.dayPnlPct.toFixed(2) },
      triggeredAlerts: triggeredAlerts.length,
      rebalAlerts: rebalAlerts.length,
    });
  } catch (e) {
    console.error('[telegram] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
