/* ============================================================================
   api/_scanner/engine.js — pullback scanner (port of the Go stock-scanner).
   Pipeline per stock: pullback → EMA touch → RSI → volume profile → golden
   cross → score. Pure functions over daily bars (oldest first).
   ============================================================================ */

export const CFG = {
  historyDays: 250,
  pullback: { lookback: 20, min: 3, max: 15 },
  ema: { periods: [20, 50, 100], tolerance: 1, slopeLookback: 5 },
  vp: { lookback: 60, bins: 50, valueArea: 70, tolerance: 1.5 },
  rsi: { period: 14, min: 40, max: 70 },
  trend: { long: 200 },
  ranking: { minScore: 65, topN: 10 },
};

/* ---------- indicators ---------- */

function ema(closes, period) {
  if (closes.length < period) return null;
  const out = new Array(closes.length).fill(0);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  out[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) out[i] = (closes[i] - out[i - 1]) * k + out[i - 1];
  return out;
}

function slope(series, validFrom, lookback) {
  const prior = series.length - 1 - lookback;
  if (prior < validFrom) return null;
  const cur = series[series.length - 1], old = series[prior];
  return cur > old ? 'UP' : cur < old ? 'DOWN' : 'FLAT';
}

function rsiFromAvg(g, l) {
  if (l === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / l);
}

function rsi(closes, period) {
  if (closes.length < period + 1) return null;
  const out = new Array(closes.length).fill(0);
  let gs = 0, ls = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch > 0) gs += ch; else ls -= ch;
  }
  let ag = gs / period, al = ls / period;
  out[period] = rsiFromAvg(ag, al);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + (ch > 0 ? ch : 0)) / period;
    al = (al * (period - 1) + (ch < 0 ? -ch : 0)) / period;
    out[i] = rsiFromAvg(ag, al);
  }
  return out;
}

function volumeProfile(bars, nBins, valueAreaPct) {
  let lo = bars[0].low, hi = bars[0].high;
  for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
  if (hi <= lo) return null;
  const w = (hi - lo) / nBins;
  const levels = Array.from({ length: nBins }, (_, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, vol: 0 }));
  for (const b of bars) {
    const range = b.high - b.low;
    if (range <= 0) {
      const idx = Math.min(nBins - 1, Math.max(0, Math.trunc((b.close - lo) / w)));
      levels[idx].vol += b.volume;
      continue;
    }
    const s = Math.max(0, Math.trunc((b.low - lo) / w));
    const e = Math.min(nBins - 1, Math.trunc((b.high - lo) / w));
    for (let i = s; i <= e; i++) {
      const overlap = Math.min(b.high, levels[i].hi) - Math.max(b.low, levels[i].lo);
      if (overlap > 0) levels[i].vol += b.volume * (overlap / range);
    }
  }
  let poc = 0, total = 0;
  levels.forEach((l, i) => { total += l.vol; if (l.vol > levels[poc].vol) poc = i; });
  const target = total * (valueAreaPct / 100);
  let a = poc, z = poc, captured = levels[poc].vol;
  while (captured < target && (a > 0 || z < nBins - 1)) {
    const canLo = a > 0, canHi = z < nBins - 1;
    const lv = canLo ? levels[a - 1].vol : 0, hv = canHi ? levels[z + 1].vol : 0;
    if (canLo && (!canHi || lv >= hv)) { a--; captured += levels[a].vol; }
    else if (canHi) { z++; captured += levels[z].vol; }
  }
  return {
    poc: (levels[poc].lo + levels[poc].hi) / 2,
    vah: levels[z].hi,
    val: levels[a].lo,
    levels,
  };
}

const pctDist = (a, b) => (b === 0 ? Infinity : Math.abs(a - b) / b * 100);

/* ---------- scoring tables ---------- */

const pullbackScore = p => (p >= 3 && p < 5 ? 15 : p >= 5 && p < 8 ? 13 : p >= 8 && p < 12 ? 9 : p >= 12 && p <= 15 ? 5 : 0);

function emaScore(period, sl) {
  let base = period === 20 ? 25 : period === 50 ? 23 : period === 100 ? 20 : 15;
  if (sl === 'FLAT') base -= 5; else if (sl === 'DOWN') base -= 10;
  return Math.max(0, base);
}

const vpScore = (sig, inside) => (sig === 'POC_SUPPORT' ? 25 : sig === 'VAL_SUPPORT' ? 23 : sig === 'HIGH_VOLUME_NODE' ? 18 : inside ? 10 : 0);

function rsiScore(cur, trendScore) {
  if (cur >= 45 && cur < 55 && trendScore === 3) return 20;
  if (cur >= 55 && cur < 65) return 17;
  if (cur >= 40 && cur < 45) return 12;
  if (cur >= 65 && cur < 70) return 8;
  return 10;
}

const ratingFor = t => (t >= 85 ? 'EXCELLENT' : t >= 75 ? 'STRONG' : t >= 65 ? 'WATCHLIST' : t >= 50 ? 'WEAK' : 'IGNORE');

/* ---------- evaluate one stock ---------- */

/** Returns { candidate } when it qualifies, otherwise { skip: reason }. */
export function evaluate(stock, bars) {
  const [symbol, companyName, sector, indexes] = stock;
  const { pullback: PB, ema: EM, vp: VP, rsi: RS, trend: TR } = CFG;
  const need = Math.max(...EM.periods, TR.long) + EM.slopeLookback;
  if (bars.length < need) return { skip: `insufficient history (${bars.length}/${need})` };

  const closes = bars.map(b => b.close);
  const n = closes.length;
  const last = bars[n - 1];

  // 1. pullback from the highest close in the lookback window
  const win = closes.slice(Math.max(0, n - PB.lookback));
  const swingHigh = Math.max(...win);
  if (!(swingHigh > 0)) return { skip: 'bad swing high' };
  const pullbackPct = (swingHigh - last.close) / swingHigh * 100;
  if (!(last.close < swingHigh && pullbackPct >= PB.min && pullbackPct <= PB.max)) return { skip: 'pullback out of range' };

  // 2. EMA touch
  const snaps = {};
  const touched = [];
  let closest = Infinity;
  for (const p of EM.periods) {
    const series = ema(closes, p);
    const value = series[n - 1];
    snaps[p] = { value, slope: slope(series, p - 1, EM.slopeLookback) };
    const dist = Math.abs(last.close - value) / value * 100;
    if ((last.low <= value && last.high >= value) || dist <= EM.tolerance) {
      touched.push(`EMA${p}`);
      if (dist < closest) closest = dist;
    }
  }
  if (!touched.length) return { skip: 'no EMA touch' };

  // 3. RSI: not overbought, rising
  const rs = rsi(closes, RS.period);
  if (!rs || rs.length < RS.period + 6) return { skip: 'insufficient RSI history' };
  const rn = rs.length;
  const cur = rs[rn - 1], prev = rs[rn - 2], r3 = rs[rn - 4], r5 = rs[rn - 6];
  if (cur >= RS.max) return { skip: 'RSI overbought' };
  if (!(cur > prev)) return { skip: 'RSI not rising' };
  const rsiTrendScore = (cur > prev ? 1 : 0) + (cur > r3 ? 1 : 0) + (cur > r5 ? 1 : 0);

  // 4. volume profile (survivors only)
  const strongest = Math.min(...touched.map(t => Number(t.slice(3))));
  const touchedVal = snaps[strongest].value;
  const vpWin = bars.slice(Math.max(0, n - VP.lookback));
  const prof = volumeProfile(vpWin, VP.bins, VP.valueArea);
  if (!prof) return { skip: 'degenerate volume profile' };
  const price = last.close;
  let signal = 'NO_CLEAR_SUPPORT', support = prof.poc, supportDist = pctDist(price, prof.poc);
  if (touchedVal > 0 && pctDist(touchedVal, prof.poc) <= VP.tolerance) {
    signal = 'POC_SUPPORT';
  } else if (touchedVal > 0 && pctDist(touchedVal, prof.val) <= VP.tolerance) {
    signal = 'VAL_SUPPORT'; support = prof.val; supportDist = pctDist(price, prof.val);
  } else {
    const nodes = [...prof.levels].sort((a, b) => b.vol - a.vol).slice(0, 3).map(l => (l.lo + l.hi) / 2);
    let best = Infinity, node = 0;
    for (const nd of nodes) { const d = pctDist(price, nd); if (d < best) { best = d; node = nd; } }
    if (best <= VP.tolerance) { signal = 'HIGH_VOLUME_NODE'; support = node; supportDist = best; }
  }

  // 5. golden cross + trend context
  const e200 = ema(closes, TR.long)[n - 1];
  const e20 = snaps[20].value, e50 = snaps[50].value, e100 = snaps[100].value;
  if (!(e50 > 0 && e200 > 0 && e50 > e200)) return { skip: 'no golden cross' };
  const trend = {
    price_above_ema200: price > e200,
    ema20_above_ema50: e20 > e50,
    ema50_above_ema100: e50 > e100,
    golden_cross: true,
  };
  const trendPts = (trend.price_above_ema200 ? 5 : 0) + (trend.ema20_above_ema50 ? 4 : 0)
    + (trend.ema50_above_ema100 ? 3 : 0) + (e100 > e200 ? 3 : 0);

  // 6. score
  const inside = prof.val > 0 && prof.vah > 0 && price >= prof.val && price <= prof.vah;
  const score = pullbackScore(pullbackPct) + emaScore(strongest, snaps[strongest].slope)
    + vpScore(signal, inside) + rsiScore(cur, rsiTrendScore) + trendPts;

  return {
    candidate: {
      symbol, company_name: companyName, indexes, sector,
      price,
      pullback_percent: pullbackPct,
      recent_swing_high: swingHigh,
      ema20: e20, ema50: e50, ema100: e100,
      ema_touch: touched,
      ema_distance_percent: closest,
      ema20_slope: snaps[20].slope, ema50_slope: snaps[50].slope, ema100_slope: snaps[100].slope,
      rsi: cur, rsi_previous: prev, rsi_3_days_ago: r3, rsi_5_days_ago: r5, rsi_trend: 'UP',
      volume_profile: {
        poc: prof.poc, vah: prof.vah, val: prof.val,
        nearest_support: support, distance_to_support_percent: supportDist, signal,
      },
      trend,
      score,
      rating: ratingFor(score),
      market_data_timestamp: new Date(last.ts * 1000).toISOString(),
    },
  };
}

/* ---------- market data (Yahoo chart endpoint) ---------- */

export async function fetchBars(symbol, attempt = 0) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - CFG.historyDays * 2 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${start}&period2=${end}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioScanner/1.0)' }, signal: AbortSignal.timeout(15000) });
  if (r.status === 429 && attempt < 2) {
    await new Promise(ok => setTimeout(ok, 800 * (attempt + 1)));
    return fetchBars(symbol, attempt + 1);
  }
  if (!r.ok) throw new Error(`yahoo HTTP ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  const q = res?.indicators?.quote?.[0];
  if (!res || !q) throw new Error(j?.chart?.error?.description || 'no data');
  const bars = [];
  (res.timestamp || []).forEach((ts, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
    if ([o, h, l, c, v].some(x => x == null)) return;
    bars.push({ ts, open: o, high: h, low: l, close: c, volume: v });
  });
  if (!bars.length) throw new Error('all bars null');
  return bars;
}
