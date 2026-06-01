/* ============================================================================
   api/prices.js — Vercel Serverless Function (Node 18+ runtime)

   Ports the user's Google Apps Script price functions to the server side so the
   browser can fetch live prices same-origin (Yahoo / settrade send no CORS
   headers, so they can only be reached from a server — exactly like
   UrlFetchApp.fetch in Apps Script).

   POST body (application/json):
   {
     yahoo:  [{ key, name, symbol }],   // US stock / ETF / Thai (.BK) / Gold (GC=F)
     funds:  [{ key, name, ticker }],   // Thai mutual funds (settrade)
     crypto: [{ key, name, id }],       // CoinGecko ids, priced vs THB
     fx:     true                       // include USD->THB
   }

   Response:
   {
     prices: { "<key>:<name>": <pricePerUnit native ccy>, ... },
     fx:     { USDTHB: <number> },
     errors: [ "<key>:<name> reason", ... ],
     ts:     <epoch ms>
   }
   ============================================================================ */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ---- Yahoo Finance chart API (=GOOGLEFINANCE / THAISTOCK / YAHOO_PRICE) -----
async function yahooPrice(symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;
  for (const host of hosts) {
    try {
      // includePrePost=true adds pre/post market candles; 5m intervals keep payload small (~3KB)
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = new Error('no result'); continue; }
      const meta = result.meta;
      const price = meta?.regularMarketPrice;
      if (price == null) { lastErr = new Error('no price field'); continue; }

      // Find the last non-null close and its timestamp
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      let lastClose = null, lastTs = null;
      for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] != null) { lastClose = closes[i]; lastTs = timestamps[i]; break; }
      }

      let pre = null, post = null;
      if (lastClose != null && lastTs != null) {
        const tp = meta.currentTradingPeriod || {};
        if (tp.pre && lastTs >= tp.pre.start && lastTs < tp.pre.end) {
          pre = { price: +lastClose.toFixed(4), pct: (lastClose - price) / price * 100 };
        } else if (tp.post && lastTs >= tp.post.start && lastTs < tp.post.end) {
          post = { price: +lastClose.toFixed(4), pct: (lastClose - price) / price * 100 };
        }
      }

      return { price, pre, post };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('yahoo failed');
}

// ---- settrade mutual-fund NAV (=setMutualfundInfo) --------------------------
function getField(field, contentText, input, result) {
  const m = contentText.match(new RegExp(`${field}:([\\w\\$]+)`));
  if (!m) throw new Error(`field ${field} not found`);
  const idx = input.findIndex(a => a === m[1]);
  if (idx === -1) throw new Error(`var ${m[1]} not in input`);
  return result[idx];
}

async function fundNav(ticker) {
  const url = `https://www.settrade.com/th/mutualfund/quote/${encodeURIComponent(ticker)}/overview`;
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const html = await r.text();

  const matchInput = html.match(/window\.__NUXT__=\(function\(([^)]*)\)/);
  if (!matchInput) throw new Error('NUXT input not found');
  const input = matchInput[1].split(',');

  const matchResult = html.match(/}}\(([\s\S]*?)(?=\)\);)/);
  if (!matchResult) throw new Error('NUXT result not found');

  const cleaned = matchResult[1]
    .replace(/void 0/g, 'null')
    .replace(/undefined/g, 'null')
    .replace(/(?<=,)(\.)(?=\d)/g, '0$1')
    .replace(/(?<=,)-\.(?=\d)/g, '-0.');

  const result = JSON.parse('[' + cleaned + ']');
  return getField('navPerUnit', html, input, result);
}

// ---- CoinGecko (=IMPORTDATA simple/price) -----------------------------------
async function cryptoPrices(ids) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${uniq.join(',')}&vs_currencies=thb`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('coingecko HTTP ' + r.status);
  return r.json();
}

// ---- FX rates: USDTHB, JPYTHB, KRWTHB --------------------------------------
async function fetchFxRates() {
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=THB,JPY,KRW');
    if (r.ok) {
      const j = await r.json();
      if (j && j.rates && j.rates.THB) {
        const USDTHB = j.rates.THB;
        return {
          USDTHB,
          JPYTHB: j.rates.JPY ? USDTHB / j.rates.JPY : null,
          KRWTHB: j.rates.KRW ? USDTHB / j.rates.KRW : null,
        };
      }
    }
  } catch (e) {}
  // fallback: derive USDTHB from CoinGecko (BTC thb / BTC usd)
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=thb,usd');
    if (r.ok) {
      const j = await r.json();
      if (j.bitcoin && j.bitcoin.thb && j.bitcoin.usd) {
        return { USDTHB: j.bitcoin.thb / j.bitcoin.usd, JPYTHB: null, KRWTHB: null };
      }
    }
  } catch (e) {}
  throw new Error('fx failed');
}

import { readBody } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = await readBody(req);
  const prices = {};
  const prePost = {};
  const errors = [];
  const tasks = [];

  for (const it of (body.yahoo || [])) {
    tasks.push(yahooPrice(it.symbol)
      .then(({ price, pre, post }) => {
        const k = `${it.key}:${it.name}`;
        prices[k] = price;
        const active = post || pre;
        if (active) prePost[k] = { ...active, type: post ? 'post' : 'pre' };
      })
      .catch(e => errors.push(`${it.key}:${it.name} ${e.message}`)));
  }
  for (const it of (body.funds || [])) {
    tasks.push(fundNav(it.ticker)
      .then(p => { prices[`${it.key}:${it.name}`] = p; })
      .catch(e => errors.push(`${it.key}:${it.name} ${e.message}`)));
  }

  let fx = null;
  const cryptoList = body.crypto || [];
  if (cryptoList.length) {
    tasks.push(cryptoPrices(cryptoList.map(c => c.id))
      .then(map => { for (const c of cryptoList) { const v = map[c.id] && map[c.id].thb; if (v != null) prices[`${c.key}:${c.name}`] = v; } })
      .catch(e => errors.push('crypto ' + e.message)));
  }
  if (body.fx) {
    tasks.push(fetchFxRates().then(v => { fx = v; }).catch(e => errors.push('fx ' + e.message)));
  }

  await Promise.allSettled(tasks);

  // light caching at the edge (30s)
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  return res.status(200).json({ prices, prePost, fx, errors, ts: Date.now() });
}
