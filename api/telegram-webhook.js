/* ============================================================================
   api/telegram-webhook.js — Receive Telegram bot commands

   Supported commands:
     /AAPL          → US stock price + analysis + 30-day chart
     /BTC           → Crypto price + analysis + 30-day chart
     /SCB.BK        → Thai stock price + analysis + 30-day chart
     /QQQM          → ETF price + analysis + 30-day chart
     /report        → Send the daily portfolio report now
     /help          → Show command list

   ── Setup ────────────────────────────────────────────────────────────────────
   1. Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, PORTFOLIO_ID, Supabase env vars.
   2. Optionally set TELEGRAM_WEBHOOK_SECRET (any random string ≥ 32 chars).
   3. Register the webhook once by calling:
        GET /api/telegram-webhook?setup=1
      Or call the Telegram API directly:
        POST https://api.telegram.org/bot{TOKEN}/setWebhook
        { "url": "https://your-app.vercel.app/api/telegram-webhook",
          "secret_token": "<TELEGRAM_WEBHOOK_SECRET>" }
   ============================================================================ */

const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID        = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ── Known crypto tickers → CoinGecko ID ────────────────────────────────────────
const CRYPTO_MAP = {
  BTC:    'bitcoin',       ETH:    'ethereum',      BNB:    'binancecoin',
  SOL:    'solana',        XRP:    'ripple',         USDT:   'tether',
  USDC:   'usd-coin',      ADA:    'cardano',        DOGE:   'dogecoin',
  DOT:    'polkadot',      AVAX:   'avalanche-2',    LINK:   'chainlink',
  LTC:    'litecoin',      MATIC:  'matic-network',  TON:    'the-open-network',
  SHIB:   'shiba-inu',     UNI:    'uniswap',        ATOM:   'cosmos',
  NEAR:   'near',          APT:    'aptos',           ARB:    'arbitrum',
  BTCTHB: 'bitcoin',       ETHTHB: 'ethereum',
};

// ── Ticker detection ───────────────────────────────────────────────────────────

function detectTicker(raw) {
  const t = raw.toUpperCase().trim().replace(/^\//, '');
  const cryptoId = CRYPTO_MAP[t];
  if (cryptoId) return { type: 'crypto', symbol: t, id: cryptoId };
  if (t.endsWith('.BK')) return { type: 'thai', symbol: t };
  return { type: 'stock', symbol: t };
}

// ── Yahoo Finance helpers ──────────────────────────────────────────────────────

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
      const j  = await r.json();
      const res = j?.chart?.result?.[0];
      if (!res) continue;
      const closes     = res.indicators?.quote?.[0]?.close || [];
      const timestamps = res.timestamp || [];
      return { closes: closes.filter(Boolean), timestamps };
    } catch (_) {}
  }
  return { closes: [], timestamps: [] };
}

// ── CoinGecko helpers ──────────────────────────────────────────────────────────

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

// ── Chart builder (QuickChart.io) ──────────────────────────────────────────────

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

// ── Format helpers ─────────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function fmtPrice(v, ccy) {
  if (v == null) return '—';
  const sym = ccy === 'USD' ? '$' : (ccy === 'THB' ? '฿' : (ccy + ' '));
  return sym + fmtNum(v);
}

// ── Analysis message builders ──────────────────────────────────────────────────

function buildStockCaption(symbol, q) {
  const name      = esc(q.shortName || q.longName || symbol);
  const ccy       = q.currency || 'USD';
  const price     = q.regularMarketPrice;
  const change    = q.regularMarketChange ?? 0;
  const changePct = q.regularMarketChangePercent ?? 0;
  const isUp      = change >= 0;
  const arrow     = isUp ? '📈' : '📉';
  const sign      = isUp ? '+' : '';

  let msg = `${arrow} <b>${name}</b>  <code>${esc(symbol)}</code>\n\n`;

  // Price + change
  msg += `💵 <b>${fmtPrice(price, ccy)}</b>  `;
  msg += `${sign}${fmtPrice(Math.abs(change), ccy)} (${sign}${changePct.toFixed(2)}%)\n`;

  // Day range
  if (q.regularMarketDayLow != null && q.regularMarketDayHigh != null) {
    msg += `📊 Day: ${fmtPrice(q.regularMarketDayLow, ccy)} – ${fmtPrice(q.regularMarketDayHigh, ccy)}\n`;
  }

  // 52-week range
  if (q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null) {
    const pos52 = ((price - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow) * 100).toFixed(0);
    msg += `📅 52W: ${fmtPrice(q.fiftyTwoWeekLow, ccy)} – ${fmtPrice(q.fiftyTwoWeekHigh, ccy)}  (at ${pos52}%)\n`;
  }

  // Volume
  if (q.regularMarketVolume != null) {
    msg += `💹 Vol: ${fmtNum(q.regularMarketVolume, 0)}\n`;
  }

  // Fundamental metrics
  const extras = [];
  if (q.trailingPE != null)    extras.push(`P/E: ${q.trailingPE.toFixed(1)}×`);
  if (q.marketCap != null)     extras.push(`Cap: ${fmtNum(q.marketCap)}`);
  if (q.epsTrailingTwelveMonths != null) extras.push(`EPS: ${fmtPrice(q.epsTrailingTwelveMonths, ccy)}`);
  if (extras.length) msg += `📐 ${extras.join('   ')}\n`;

  // Moving averages
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

  // Exchange / market status
  if (q.exchangeName) {
    const status = q.marketState === 'REGULAR' ? '🟢 Market open'
                 : q.marketState === 'PRE'     ? '🌅 Pre-market'
                 : q.marketState === 'POST'    ? '🌙 After-hours'
                 : '⚫ Market closed';
    msg += `\n${status}  ·  ${esc(q.exchangeName)}`;
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

  let msg = `${arrow} <b>${esc(symbol)}</b>  <code>Crypto</code>\n\n`;
  msg += `💵 <b>฿${fmtNum(thb)}</b>`;
  if (usd != null) msg += `  ($${fmtNum(usd)})`;
  msg += `\n`;
  msg += `24h: <b>${sign}${change24h.toFixed(2)}%</b>  (${sign}฿${fmtNum(thb - prevThb)})\n`;

  if (data.thb_24h_vol != null) msg += `💹 Vol 24h: ฿${fmtNum(data.thb_24h_vol)}\n`;
  if (data.thb_market_cap != null) msg += `📐 Cap: ฿${fmtNum(data.thb_market_cap)}\n`;

  return msg;
}

// ── Telegram senders ───────────────────────────────────────────────────────────

async function tgSend(chatId, text, opts = {}) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts }),
  });
  return r.json();
}

async function tgPhoto(chatId, photoUrl, caption) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' }),
  });
  return r.json();
}

// ── Command handlers ───────────────────────────────────────────────────────────

async function handleTickerCommand(chatId, raw) {
  const ticker = raw.replace(/^\//, '').trim();
  const { type, symbol, id } = detectTicker(ticker);

  await tgSend(chatId, `⏳ Fetching <b>${esc(symbol.toUpperCase())}</b>…`);

  try {
    if (type === 'crypto') {
      const [priceData, chartCloses] = await Promise.all([
        geckoPrice(id),
        geckoChart(id, 30),
      ]);

      if (!priceData) {
        await tgSend(chatId, `❌ Could not find crypto: <code>${esc(symbol)}</code>`);
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
      // Stock / ETF / Thai (.BK)
      let ySymbol = symbol.toUpperCase();

      const [quote, chartData] = await Promise.all([
        yahooQuote(ySymbol),
        yahooChart(ySymbol, '1mo', '1d'),
      ]);

      // If not found and looks like a Thai ticker (no dot), retry with .BK
      if (!quote && !ySymbol.includes('.')) {
        const bkSymbol = ySymbol + '.BK';
        const [q2, c2] = await Promise.all([
          yahooQuote(bkSymbol),
          yahooChart(bkSymbol, '1mo', '1d'),
        ]);
        if (q2) {
          await handleTickerResult(chatId, bkSymbol, q2, c2.closes);
          return;
        }
      }

      if (!quote) {
        await tgSend(chatId, `❌ Ticker not found: <code>${esc(ySymbol)}</code>\n\nTips:\n• Thai stocks: <code>/SCB.BK</code>\n• Crypto: <code>/BTC</code>\n• US stocks/ETF: <code>/AAPL</code>`);
        return;
      }

      await handleTickerResult(chatId, ySymbol, quote, chartData.closes);
    }
  } catch (e) {
    console.error('[webhook] ticker error:', e.message);
    await tgSend(chatId, `⚠️ Error fetching <code>${esc(symbol)}</code>: ${esc(e.message)}`);
  }
}

async function handleTickerResult(chatId, symbol, quote, closes) {
  const price  = quote.regularMarketPrice;
  const change = quote.regularMarketChange ?? 0;
  const isUp   = change >= 0;
  const caption = buildStockCaption(symbol, quote);
  const chartUrl = buildChartUrl(closes, isUp);

  if (chartUrl && closes.length >= 5) {
    const res = await tgPhoto(chatId, chartUrl, caption);
    // Fall back to text if photo fails (e.g. QuickChart URL too long)
    if (!res.ok) await tgSend(chatId, caption);
  } else {
    await tgSend(chatId, caption);
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

async function handleReport(chatId, portfolioId) {
  await tgSend(chatId, '⏳ Building portfolio report…');
  try {
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const r = await fetch(`${origin}/api/telegram`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ manual: true, portfolioId }),
    });
    const j = await r.json();
    if (!r.ok) await tgSend(chatId, `⚠️ Report failed: ${esc(j.error || 'unknown error')}`);
  } catch (e) {
    await tgSend(chatId, `⚠️ Report error: ${esc(e.message)}`);
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // ── Webhook registration helper: GET /api/telegram-webhook?setup=1 ─────────
  if (req.method === 'GET' && req.query?.setup === '1') {
    if (!BOT_TOKEN) return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
    const host = req.headers.host || process.env.VERCEL_URL;
    if (!host) return res.status(400).json({ error: 'Cannot determine host URL. Set VERCEL_URL.' });
    const webhookUrl = `https://${host}/api/telegram-webhook`;
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

  // Only accept POST from Telegram
  if (req.method !== 'POST') return res.status(405).end();

  // Validate secret token if configured
  if (WEBHOOK_SECRET) {
    const incoming = req.headers['x-telegram-bot-api-secret-token'];
    if (incoming !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'invalid secret' });
    }
  }

  // Parse the Telegram update
  let update;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    update = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_) {
    return res.status(400).json({ error: 'invalid json' });
  }

  // Always return 200 quickly to prevent Telegram from retrying
  res.status(200).json({ ok: true });

  const message = update?.message || update?.edited_message;
  if (!message) return;

  const chatId = String(message.chat?.id);
  const text   = (message.text || '').trim();

  // Security: only respond to the configured chat
  if (CHAT_ID && chatId !== String(CHAT_ID)) {
    await tgSend(chatId, '🔒 Unauthorized.');
    return;
  }

  if (!BOT_TOKEN) return;

  const lower = text.toLowerCase();

  if (lower === '/help' || lower === '/start') {
    await handleHelp(chatId);
  } else if (lower === '/report') {
    const pid = process.env.PORTFOLIO_ID;
    if (!pid) { await tgSend(chatId, '⚠️ PORTFOLIO_ID env var is not set.'); return; }
    await handleReport(chatId, pid);
  } else if (text.startsWith('/') && text.length > 1) {
    // Extract ticker from command (ignore bot username: /AAPL@mybot → AAPL)
    const raw = text.slice(1).split('@')[0];
    if (/^[A-Za-z0-9._-]+$/.test(raw)) {
      await handleTickerCommand(chatId, raw);
    }
  }
}
