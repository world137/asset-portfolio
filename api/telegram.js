/* ============================================================================
   api/telegram.js — Telegram bot: daily portfolio report + command webhook

   POST /api/telegram { manual: true }  — send report on demand
   POST /api/telegram (cron)            — send scheduled report
   GET  /api/telegram?setup=1           — register the Telegram webhook
   POST /api/telegram (Telegram update) — receive bot commands (detected via
                                          x-telegram-bot-api-secret-token header
                                          or Content-Type absence of manual flag)

   Required env vars:
     TELEGRAM_BOT_TOKEN      — BotFather token
     TELEGRAM_CHAT_ID        — personal chat ID or channel ID
     PORTFOLIO_ID            — portfolio sync ID
     SUPABASE_URL            — Supabase project URL
     SUPABASE_SERVICE_KEY    — Supabase service_role key
   Optional:
     TELEGRAM_WEBHOOK_SECRET — random string ≥ 32 chars for webhook validation
   ============================================================================ */


const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID        = process.env.TELEGRAM_CHAT_ID;
const PORTFOLIO_ID   = process.env.PORTFOLIO_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ── Report constants ───────────────────────────────────────────────────────────

const REPORT_CLASSES = [
  { key: 'crypto',    label: 'Crypto', short: 'Crypto', live: 'crypto',    ccy: 'THB' },
  { key: 'usaStock',  label: 'USA',    short: 'USA',    live: 'yahoo',     ccy: 'USD' },
  { key: 'etf',       label: 'ETF',    short: 'ETF',    live: 'yahoo',     ccy: 'USD' },
  { key: 'thaiStock', label: 'Thai',   short: 'Thai',   live: 'yahoo',     ccy: 'THB', yahooSuffix: '.BK' },
  { key: 'fund',      label: 'Fund',   short: 'Fund',   live: 'settrade',  ccy: 'THB' },
  { key: 'gold',      label: 'Gold',   short: 'Gold',   live: 'yahoo',     ccy: 'USD', yahooSymbol: 'GC=F' },
];

const CRYPTO_MAP = {
  BTC:    'bitcoin',      ETH:    'ethereum',      BNB:    'binancecoin',
  SOL:    'solana',       XRP:    'ripple',         USDT:   'tether',
  USDC:   'usd-coin',     ADA:    'cardano',        DOGE:   'dogecoin',
  DOT:    'polkadot',     AVAX:   'avalanche-2',    LINK:   'chainlink',
  LTC:    'litecoin',     MATIC:  'matic-network',  TON:    'the-open-network',
  SHIB:   'shiba-inu',    UNI:    'uniswap',        ATOM:   'cosmos',
  NEAR:   'near',         APT:    'aptos',           ARB:    'arbitrum',
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
      if (row.pair === 'USDTHB')      fx.USDTHB = parseFloat(row.rate);
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

async function yahooQuote(symbol) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const r   = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const q = j?.quoteResponse?.result?.[0];
      if (q) return q;
    } catch (_) {}
  }
  return null;
}

async function yahooChart(symbol, range = '1mo', interval = '1d') {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
      const r   = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) continue;
      const j   = await r.json();
      const res = j?.chart?.result?.[0];
      if (!res) continue;
      const closes     = res.indicators?.quote?.[0]?.close || [];
      const timestamps = res.timestamp || [];
      return { closes: closes.filter(Boolean), timestamps };
    } catch (_) {}
  }
  return { closes: [], timestamps: [] };
}

async function cryptoDayChanges(ids) {
  const uniq = [...new Set(ids)].join(',');
  const url  = `https://api.coingecko.com/api/v3/simple/price?ids=${uniq}&vs_currencies=thb&include_24hr_change=true`;
  const r    = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('CoinGecko HTTP ' + r.status);
  return r.json();
}

async function geckoPrice(id) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=thb,usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
  const r   = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('CoinGecko ' + r.status);
  const j = await r.json();
  return j[id] || null;
}

async function geckoChart(id, days = 30) {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=thb&days=${days}&interval=daily`;
  const r   = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.prices || []).map(([, price]) => price);
}

// ── Report builder ─────────────────────────────────────────────────────────────

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
                  const price     = entry.thb;
                  const pct       = entry.thb_24h_change;
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

  const prevTotal = totalTHB - dayPnlTHB;
  const dayPnlPct = prevTotal > 0 ? (dayPnlTHB / prevTotal) * 100 : 0;
  return { totalTHB, dayPnlTHB, dayPnlPct, coveredCount };
}

// ── Alert checkers ─────────────────────────────────────────────────────────────

// Fetch prices for alerts on assets not in the holdings list.
// classKey is always set (thaiStock | usaStock | etf) — determines which API to use.
async function fetchNonHoldingPrices(priceAlerts, assetData) {
  // Find active alerts whose key is not already in assetData
  const missing = priceAlerts.filter(a =>
    !a.triggered && a.classKey && a.name && assetData[`${a.classKey}:${a.name}`] == null
  );
  if (!missing.length) return {};

  const result = {};
  await Promise.allSettled(missing.map(async a => {
    const key = `${a.classKey}:${a.name}`;
    try {
      if (a.classKey === 'thaiStock' || a.classKey === 'usaStock' || a.classKey === 'etf') {
        const sym = a.name.toUpperCase();
        const { price, prevClose } = await yahooPrice(sym);
        if (price != null) {
          const ccy = a.classKey === 'thaiStock' ? 'THB' : 'USD';
          const pct = prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
          result[key] = { price, prevClose, pct, changeAbs: prevClose ? price - prevClose : null, ccy, classShort: a.classKey };
        }
      }
    } catch (e) {
      console.warn(`[telegram] fetchNonHoldingPrices ${key}: ${e.message}`);
    }
  }));
  return result;
}

async function checkPriceAlerts(priceAlerts, assetData) {
  if (!priceAlerts?.length) return [];

  const nonHoldingPrices = await fetchNonHoldingPrices(priceAlerts, assetData);
  const combined = { ...assetData, ...nonHoldingPrices };

  return priceAlerts
    .filter(a => !a.triggered)
    .flatMap(alert => {
      const key = `${alert.classKey}:${alert.name}`;
      const d   = combined[key];
      if (!d || d.price == null) return [];
      const hit = alert.condition === 'above' ? d.price >= alert.price : d.price <= alert.price;
      return hit ? [{ alert, price: d.price, ccy: d.ccy }] : [];
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
      const key   = `${cls.key}:${h.name}`;
      const d     = assetData[key];
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

// ── Report formatters ──────────────────────────────────────────────────────────

const REPORT_DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

const CLASS_EMOJI = {
  crypto:    '🪙',
  usaStock:  '🇺🇸',
  etf:       '📦',
  thaiStock: '🇹🇭',
  fund:      '🏦',
  gold:      '🥇',
};

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function todayTH() {
  const local = new Date(new Date().getTime() + 7 * 3600000);
  const [y, m, d] = local.toISOString().slice(0, 10).split('-');
  const h   = String(local.getUTCHours()).padStart(2, '0');
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
  const sym = ccy === 'USD' ? '$' : (ccy === 'THB' ? '฿' : (ccy + ' '));
  if (v == null) return '—';
  const abs = Math.abs(v);
  let s;
  if (abs >= 1e6)       s = (abs / 1e6).toFixed(2) + 'M';
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
  if (abs >= 1000)      s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  else if (abs >= 10)   s = abs.toFixed(2);
  else if (abs >= 0.01) s = abs.toFixed(4);
  else                  s = abs.toFixed(6);
  return (v >= 0 ? '+' : '-') + sym + s;
}

function fmtNum(v, decimals = 2) {
  if (v == null || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3)  return abs < 1e4 ? v.toFixed(decimals) : v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (abs >= 1)    return v.toFixed(decimals);
  if (abs >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

function formatReportMessage(groups, assetData, summary) {
  if (!groups.length) return null;

  const { date, time } = todayTH();
  const D = REPORT_DIVIDER;

  // Section 1: Header
  const moodEmoji = summary.dayPnlPct >= 1 ? '🟢' : summary.dayPnlPct <= -1 ? '🔴' : '🟡';
  let msg = `${moodEmoji} <b>Daily Portfolio Report</b>\n`;
  msg    += `<code>${date} · ${time} ICT</code>\n`;
  msg    += `${D}\n`;

  // Section 2: Portfolio summary
  if (summary.totalTHB > 0) {
    const pnlSign  = summary.dayPnlTHB >= 0 ? '+' : '';
    const pnlArrow = summary.dayPnlTHB >= 0 ? '▲' : '▼';
    const allAssets = groups.flatMap(g => g.assets);
    const gainers   = allAssets.filter(a => a.pct > 0).length;
    const losers    = allAssets.filter(a => a.pct < 0).length;

    msg += `💼 <b>฿${fmtBig(summary.totalTHB)}</b>   `;
    msg += `${pnlArrow} <b>${pnlSign}฿${fmtBig(Math.abs(summary.dayPnlTHB))}</b> `;
    msg += `<i>(${pnlSign}${summary.dayPnlPct.toFixed(2)}%)</i>\n`;
    msg += `<code>${gainers} up  ${losers} down  ${summary.coveredCount} tracked</code>\n`;
  }
  msg += `${D}\n`;

  // Section 3: Per-class breakdown
  for (const g of groups) {
    const em    = CLASS_EMOJI[g.key] || '📁';
    const n     = g.assets.length;
    const best  = g.assets[0];
    const worst = g.assets[n - 1];
    const bSign = best.pct  >= 0 ? '+' : '';
    const wSign = worst.pct >= 0 ? '+' : '';

    if (n === 1) {
      const arrow = best.pct >= 0 ? '▲' : '▼';
      msg += `${em} <b>${escHtml(g.label)}</b>  ${arrow} ${escHtml(best.name)} <code>${bSign}${best.pct.toFixed(2)}%</code>\n`;
    } else {
      msg += `${em} <b>${escHtml(g.label)}</b> <i>(${n})</i>  `;
      msg += `▲ ${escHtml(best.name)} <code>${bSign}${best.pct.toFixed(2)}%</code>  `;
      msg += `▼ ${escHtml(worst.name)} <code>${wSign}${worst.pct.toFixed(2)}%</code>\n`;
    }
  }
  msg += `${D}\n`;

  // Section 4: Per-class ranked tables
  const pad    = (s, n) => String(s).padEnd(n);
  const padR   = (s, n) => String(s).padStart(n);
  const pctStr = r => (r.pct >= 0 ? '▲+' : '▼') + r.pct.toFixed(2) + '%';

  for (const g of groups) {
    const em   = CLASS_EMOJI[g.key] || '📁';
    const rows = [...g.assets]
      .sort((a, b) => b.pct - a.pct)
      .map((a, i) => ({
        rank:  String(i + 1) + '.',
        name:  a.name,
        pct:   pctStr(a),
        price: fmtPrice(a.price, a.ccy),
        chg:   a.changeAbs != null ? fmtChange(a.changeAbs, a.ccy) : '—',
      }));

    if (!rows.length) continue;

    const rkW = Math.max(2, ...rows.map(r => r.rank.length));
    const nW  = Math.max(4, ...rows.map(r => r.name.length));
    const pW  = Math.max(5, ...rows.map(r => r.pct.length));
    const prW = Math.max(5, ...rows.map(r => r.price.length));
    const gW  = Math.max(3, ...rows.map(r => r.chg.length));

    const hdr  = pad('#', rkW) + ' ' + pad('Name', nW) + '  ' + padR('Day%', pW) + '  ' + padR('Price', prW) + '  ' + padR('Chg', gW);
    const sep  = '─'.repeat(hdr.length);
    const body = rows.map(r =>
      pad(r.rank, rkW) + ' ' + pad(r.name, nW) + '  ' + padR(r.pct, pW) + '  ' + padR(r.price, prW) + '  ' + padR(r.chg, gW)
    ).join('\n');

    msg += `${em} <b>${escHtml(g.label)}</b>\n<pre>${escHtml(`${hdr}\n${sep}\n${body}`)}</pre>\n`;
  }

  return msg;
}

// ── Telegram senders ───────────────────────────────────────────────────────────

async function tgSend(chatId, text, opts = {}, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts }),
        signal:  AbortSignal.timeout(10000),
      });
      const j = await r.json();
      if (j.ok) return j;
      // Telegram returned ok:false — don't retry on permanent errors (e.g. chat not found)
      if (j.error_code && j.error_code !== 429) {
        console.error(`[tgSend] Telegram error ${j.error_code}: ${j.description}`);
        return j;
      }
      lastErr = new Error(`Telegram ${j.error_code}: ${j.description}`);
    } catch (e) {
      lastErr = e;
      console.warn(`[tgSend] attempt ${attempt + 1} failed: ${e.message}`);
    }
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw lastErr;
}

async function tgPhoto(chatId, photoUrl, caption) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' }),
  });
  return r.json();
}

// ── Core report sender (shared by cron/manual and /report command) ─────────────

async function runReport(portfolioId) {
  const [holdings, meta] = await Promise.all([
    loadHoldings(portfolioId),
    loadPortfolioMeta(portfolioId),
  ]);

  console.log(`[telegram] holdings: ${holdings.length}`);
  if (!holdings.length) return { ok: true, note: 'no holdings' };

  const { groups, assetData } = await buildReport(holdings);
  const summary               = computePortfolioSummary(holdings, assetData, meta.fx);
  const triggeredAlerts       = await checkPriceAlerts(meta.priceAlerts, assetData);
  const rebalAlerts           = checkRebalancingDrift(meta.targetAllocation, holdings, assetData, meta.fx);

  if (!groups.length && !triggeredAlerts.length && !rebalAlerts.length) {
    return { ok: true, note: 'no live price data' };
  }

  const { date, time } = todayTH();
  let message = formatReportMessage(groups, assetData, summary)
    || `📊 <b>Portfolio Report</b> — ${date} ${time} TH\nNo market data available.\n`;

  if (triggeredAlerts.length > 0) {
    message += `\n${REPORT_DIVIDER}\n`;
    message += `🔔 <b>Price Alerts</b>\n`;
    for (const { alert, price, ccy } of triggeredAlerts) {
      const dir  = alert.condition === 'above' ? '▲ above' : '▼ below';
      const sym  = (ccy || 'THB') === 'USD' ? '$' : '฿';
      const tgt  = sym + alert.price.toLocaleString('en', { maximumFractionDigits: 4 });
      const now  = sym + price.toLocaleString('en',        { maximumFractionDigits: 4 });
      const name = escHtml(alert.name.replace(/\.BK$/, '').replace(/THB$/, ''));
      message += `• <b>${name}</b> ${dir} <code>${escHtml(tgt)}</code> → now <code>${escHtml(now)}</code>\n`;
      if (alert.note) message += `  <i>${escHtml(alert.note)}</i>\n`;
    }
  }

  if (rebalAlerts.length > 0) {
    message += `\n${REPORT_DIVIDER}\n`;
    message += `⚖️ <b>Rebalancing</b>\n`;
    const LABELS = {
      thaiStock: 'Thai', usaStock: 'USA', etf: 'ETF',
      fund: 'Fund', crypto: 'Crypto', gold: 'Gold', other: 'Other',
    };
    const padLbl = (s, n) => String(s).padEnd(n);
    const maxLabelLen = Math.max(...rebalAlerts.map(a => (LABELS[a.key] || a.key).length));
    for (const a of rebalAlerts) {
      const lbl = padLbl(LABELS[a.key] || a.key, maxLabelLen);
      const dir = a.drift > 0 ? `+${a.drift.toFixed(1)}% overweight` : `${a.drift.toFixed(1)}% underweight`;
      message += `• ${escHtml(lbl)}  ${a.curPct.toFixed(1)}% / tgt ${a.tgt}%  ${dir}\n`;
    }
  }

  const result = await tgSend(CHAT_ID, message);
  if (!result.ok) throw new Error('Telegram API error: ' + JSON.stringify(result));

  console.log('[telegram] sent ok');
  return {
    ok: true,
    summary: {
      totalTHB:   Math.round(summary.totalTHB),
      dayPnlTHB:  Math.round(summary.dayPnlTHB),
      dayPnlPct:  summary.dayPnlPct.toFixed(2),
    },
    triggeredAlerts: triggeredAlerts.length,
    rebalAlerts:     rebalAlerts.length,
  };
}

// ── Webhook command handlers ───────────────────────────────────────────────────

function detectTicker(raw) {
  const t        = raw.toUpperCase().trim().replace(/^\//, '');
  const cryptoId = CRYPTO_MAP[t];
  if (cryptoId)      return { type: 'crypto', symbol: t, id: cryptoId };
  if (t.endsWith('.BK')) return { type: 'thai',   symbol: t };
  return { type: 'stock', symbol: t };
}

function buildChartUrl(closes, isUp) {
  if (!closes.length) return null;
  const color = isUp ? '#1a9e5c' : '#d63b3b';
  const fill  = isUp ? 'rgba(26,158,92,0.12)' : 'rgba(214,59,59,0.12)';

  const cfg = JSON.stringify({
    type: 'line',
    data: {
      labels:   closes.map((_, i) => i),
      datasets: [{
        data:            closes,
        borderColor:     color,
        backgroundColor: fill,
        fill:            true,
        pointRadius:     0,
        borderWidth:     2,
        tension:         0.3,
      }],
    },
    options: {
      scales: {
        xAxes: [{ display: false }],
        yAxes: [{ ticks: { maxTicksLimit: 4, fontColor: '#888' } }],
      },
      legend: { display: false },
    },
  });
  return `https://quickchart.io/chart?w=700&h=280&bkg=%23ffffff&c=${encodeURIComponent(cfg)}`;
}

function buildStockCaption(symbol, q) {
  const name      = escHtml(q.shortName || q.longName || symbol);
  const ccy       = q.currency || 'USD';
  const price     = q.regularMarketPrice;
  const change    = q.regularMarketChange ?? 0;
  const changePct = q.regularMarketChangePercent ?? 0;
  const isUp      = change >= 0;
  const arrow     = isUp ? '📈' : '📉';
  const sign      = isUp ? '+' : '';

  let msg = `${arrow} <b>${name}</b>  <code>${escHtml(symbol)}</code>\n\n`;
  msg += `💵 <b>${fmtPrice(price, ccy)}</b>  `;
  msg += `${sign}${fmtPrice(Math.abs(change), ccy)} (${sign}${changePct.toFixed(2)}%)\n`;

  if (q.regularMarketDayLow != null && q.regularMarketDayHigh != null) {
    msg += `📊 Day: ${fmtPrice(q.regularMarketDayLow, ccy)} – ${fmtPrice(q.regularMarketDayHigh, ccy)}\n`;
  }
  if (q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null) {
    const pos52 = ((price - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow) * 100).toFixed(0);
    msg += `📅 52W: ${fmtPrice(q.fiftyTwoWeekLow, ccy)} – ${fmtPrice(q.fiftyTwoWeekHigh, ccy)}  (at ${pos52}%)\n`;
  }
  if (q.regularMarketVolume != null) {
    msg += `💹 Vol: ${fmtNum(q.regularMarketVolume, 0)}\n`;
  }

  const extras = [];
  if (q.trailingPE != null)              extras.push(`P/E: ${q.trailingPE.toFixed(1)}×`);
  if (q.marketCap != null)               extras.push(`Cap: ${fmtNum(q.marketCap)}`);
  if (q.epsTrailingTwelveMonths != null) extras.push(`EPS: ${fmtPrice(q.epsTrailingTwelveMonths, ccy)}`);
  if (extras.length) msg += `📐 ${extras.join('   ')}\n`;

  const ma = [];
  if (q.fiftyDayAverage != null)      ma.push(`MA50: ${fmtPrice(q.fiftyDayAverage, ccy)}`);
  if (q.twoHundredDayAverage != null) ma.push(`MA200: ${fmtPrice(q.twoHundredDayAverage, ccy)}`);
  if (ma.length) {
    const above50  = q.fiftyDayAverage      && price > q.fiftyDayAverage      ? '▲' : '▼';
    const above200 = q.twoHundredDayAverage && price > q.twoHundredDayAverage ? '▲' : '▼';
    msg += `📉 ${ma[0]} ${above50}`;
    if (ma[1]) msg += `   ${ma[1]} ${above200}`;
    msg += '\n';
  }

  if (q.exchangeName) {
    const status = q.marketState === 'REGULAR' ? '🟢 Market open'
                 : q.marketState === 'PRE'     ? '🌅 Pre-market'
                 : q.marketState === 'POST'    ? '🌙 After-hours'
                 : '⚫ Market closed';
    msg += `\n${status}  ·  ${escHtml(q.exchangeName)}`;
  }

  return msg;
}

function buildCryptoCaption(symbol, data) {
  const thb       = data.thb;
  const usd       = data.usd;
  const change24h = data.thb_24h_change ?? 0;
  const isUp      = change24h >= 0;
  const arrow     = isUp ? '📈' : '📉';
  const sign      = isUp ? '+' : '';
  const prevThb   = thb / (1 + change24h / 100);

  let msg = `${arrow} <b>${escHtml(symbol)}</b>  <code>Crypto</code>\n\n`;
  msg += `💵 <b>฿${fmtNum(thb)}</b>`;
  if (usd != null) msg += `  ($${fmtNum(usd)})`;
  msg += `\n`;
  msg += `24h: <b>${sign}${change24h.toFixed(2)}%</b>  (${sign}฿${fmtNum(thb - prevThb)})\n`;
  if (data.thb_24h_vol     != null) msg += `💹 Vol 24h: ฿${fmtNum(data.thb_24h_vol)}\n`;
  if (data.thb_market_cap  != null) msg += `📐 Cap: ฿${fmtNum(data.thb_market_cap)}\n`;

  return msg;
}

async function handleTickerResult(chatId, symbol, quote, closes) {
  const change   = quote.regularMarketChange ?? 0;
  const isUp     = change >= 0;
  const caption  = buildStockCaption(symbol, quote);
  const chartUrl = buildChartUrl(closes, isUp);

  if (chartUrl && closes.length >= 5) {
    const r = await tgPhoto(chatId, chartUrl, caption);
    if (!r.ok) await tgSend(chatId, caption);
  } else {
    await tgSend(chatId, caption);
  }
}

async function handleTickerCommand(chatId, raw) {
  const ticker               = raw.replace(/^\//, '').trim();
  const { type, symbol, id } = detectTicker(ticker);

  await tgSend(chatId, `⏳ Fetching <b>${escHtml(symbol.toUpperCase())}</b>…`);

  try {
    if (type === 'crypto') {
      const [priceData, chartCloses] = await Promise.all([
        geckoPrice(id),
        geckoChart(id, 30),
      ]);

      if (!priceData) {
        await tgSend(chatId, `❌ Could not find crypto: <code>${escHtml(symbol)}</code>`);
        return;
      }

      const caption  = buildCryptoCaption(symbol.replace(/THB$/, ''), priceData);
      const isUp     = (priceData.thb_24h_change ?? 0) >= 0;
      const chartUrl = buildChartUrl(chartCloses, isUp);

      if (chartUrl && chartCloses.length >= 5) {
        await tgPhoto(chatId, chartUrl, caption);
      } else {
        await tgSend(chatId, caption);
      }
    } else {
      let ySymbol = symbol.toUpperCase();

      const [quote, chartData] = await Promise.all([
        yahooQuote(ySymbol),
        yahooChart(ySymbol, '1mo', '1d'),
      ]);

      if (!quote && !ySymbol.includes('.')) {
        const bkSymbol   = ySymbol + '.BK';
        const [q2, c2]   = await Promise.all([yahooQuote(bkSymbol), yahooChart(bkSymbol, '1mo', '1d')]);
        if (q2) { await handleTickerResult(chatId, bkSymbol, q2, c2.closes); return; }
      }

      if (!quote) {
        await tgSend(chatId, `❌ Ticker not found: <code>${escHtml(ySymbol)}</code>\n\nTips:\n• Thai stocks: <code>/SCB.BK</code>\n• Crypto: <code>/BTC</code>\n• US stocks/ETF: <code>/AAPL</code>`);
        return;
      }

      await handleTickerResult(chatId, ySymbol, quote, chartData.closes);
    }
  } catch (e) {
    console.error('[webhook] ticker error:', e.message);
    await tgSend(chatId, `⚠️ Error fetching <code>${escHtml(symbol)}</code>: ${escHtml(e.message)}`);
  }
}

async function handleHelp(chatId) {
  const msg = `📊 <b>Portfolio Bot Commands</b>\n\n`
    + `/AAPL — US stock analysis + chart\n`
    + `/BTC — Crypto analysis + chart\n`
    + `/QQQM — ETF analysis + chart\n`
    + `/SCB.BK — Thai stock (add .BK suffix)\n`
    + `/report — Send portfolio daily report now\n`
    + `/help — Show this message\n\n`
    + `<i>Tip: type any stock, ETF, or crypto ticker after /</i>`;
  await tgSend(chatId, msg);
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── Webhook registration: GET /api/telegram?setup=1 ───────────────────────
  if (req.method === 'GET' && req.query?.setup === '1') {
    if (!BOT_TOKEN) return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
    const host = req.headers.host || process.env.VERCEL_URL;
    if (!host) return res.status(400).json({ error: 'Cannot determine host URL. Set VERCEL_URL.' });
    const webhookUrl = `https://${host}/api/telegram`;
    const body = { url: webhookUrl };
    if (WEBHOOK_SECRET) body.secret_token = WEBHOOK_SECRET;
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : 400).json({ webhookUrl, telegram: j });
  }

  if (req.method !== 'POST') return res.status(405).end();

  // Read body once — needed for both paths
  let rawBody;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    rawBody = Buffer.concat(chunks);
  } catch (_) {
    rawBody = Buffer.alloc(0);
  }

  let body;
  try { body = JSON.parse(rawBody.toString('utf8')); } catch (_) { body = {}; }

  const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];

  // Telegram updates always contain update_id. Cron/manual calls never do.
  const isTelegramUpdate = body?.update_id != null || incomingSecret !== undefined;

  // ── Incoming Telegram webhook ─────────────────────────────────────────────
  if (isTelegramUpdate) {
    if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'invalid secret' });
    }
    if (!BOT_TOKEN) return res.status(400).end();

    // Respond 200 immediately so Telegram doesn't retry
    res.status(200).json({ ok: true });

    const message = body?.message || body?.edited_message;
    if (!message) return;

    const chatId = String(message.chat?.id);
    const text   = (message.text || '').trim();

    if (CHAT_ID && chatId !== String(CHAT_ID)) {
      await tgSend(chatId, '🔒 Unauthorized.');
      return;
    }

    const lower = text.toLowerCase();

    if (lower === '/help' || lower === '/start') {
      await handleHelp(chatId);
    } else if (lower === '/report') {
      const pid = process.env.PORTFOLIO_ID;
      if (!pid) { await tgSend(chatId, '⚠️ PORTFOLIO_ID env var is not set.'); return; }
      await tgSend(chatId, '⏳ Building portfolio report…');
      try {
        await runReport(pid);
      } catch (e) {
        await tgSend(chatId, `⚠️ Report error: ${escHtml(e.message)}`);
      }
    } else if (text.startsWith('/') && text.length > 1) {
      const raw = text.slice(1).split('@')[0];
      if (/^[A-Za-z0-9._-]+$/.test(raw)) await handleTickerCommand(chatId, raw);
    } else if (/^[A-Za-z][A-Za-z0-9]{0,8}(\.[A-Za-z]{1,4})?$/.test(text.trim())) {
      await handleTickerCommand(chatId, text.trim());
    }

    return;
  }

  // ── Login notification ────────────────────────────────────────────────────
  if (body?.type === 'login') {
    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn('[telegram] login noti skipped: BOT_TOKEN or CHAT_ID not set');
      return res.status(200).json({ ok: true, note: 'not configured' });
    }
    try {
      const { date, time } = todayTH();
      const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
      const msg = `🔐 <b>Login</b> — ${escHtml(body.username || 'Unknown')} signed in\n${date} ${time} TH${ip ? `\n<code>${escHtml(ip)}</code>` : ''}`;
      await tgSend(CHAT_ID, msg);
      console.log('[telegram] login noti sent');
    } catch (e) {
      console.error('[telegram] login noti error:', e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
    return res.status(200).json({ ok: true });
  }

  // ── Scheduled / manual report ─────────────────────────────────────────────
  if (!BOT_TOKEN)                     return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  if (!CHAT_ID)                       return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(400).json({ error: 'Supabase not configured' });

  let pid = body?.portfolioId || PORTFOLIO_ID;
  if (!pid) return res.status(400).json({ error: 'PORTFOLIO_ID not configured' });

  console.log(`[telegram] cron/manual pid=${pid?.slice(0, 8)}…`);

  try {
    const result = await runReport(pid);
    return res.status(200).json(result);
  } catch (e) {
    console.error('[telegram] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
