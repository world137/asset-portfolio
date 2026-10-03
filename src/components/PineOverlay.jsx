/* PineOverlay.jsx — port of pine.cs ("CDC ActionZone V2 + Ichimoku + Confluence Table +
   Volume Profile") for CandleChart: settings (every input of the script), per-bar compute,
   SVG rendering, and the settings panel. Indicator math (ta*) comes from TechnicalAnalysis.jsx;
   those globals are resolved at call time. */

// Defaults mirror the `input.*` defaults in pine.cs; show* flags are display toggles.
const PV_DEFAULTS = {
  // display
  showZone: true, showMA: true, showEMA: true, showIchi: true, showSig: true,
  showTPSL: true, showConfl: true, showVP: true, showPoc: true,
  // core EMA / MA
  fastLen: 12, slowLen: 26, ma1: 20, ma2: 50, ma3: 100, ma4: 200, ema1: 20, ema2: 50, ema3: 100, ema4: 200,
  // ichimoku
  ichiConvLen: 9, ichiBaseLen: 26, ichiSpan2Len: 52, ichiDisp: 26,
  // strategy
  atrLen: 14, tpMult: 2, slMult: 1, boxLen: 20,
  // confluence filters
  rsiLen: 14, macdFast: 12, macdSlow: 26, macdSig: 9, zLen: 20,
  adxLen: 14, adxSmooth: 14, adxThresh: 25, obvSigLen: 20, gcFast: 50, gcSlow: 200,
  // layer toggles (which layers count towards the score)
  useCDC: true, useMacd: true, useAdx: true, useObv: true, useRsi: true, useZ: true, useIchi: true, useGC: true,
  // signal
  buyThresh: 4, sellThresh: 4,
  // volume profile
  bbars: 150, cnum: 24, vpPercent: 70, pocColor: '#ff0000', pocWidth: 2,
  vupColor: '#2962ff', vdownColor: '#ff9800', vpUpColor: '#2962ff', vpDownColor: '#ff9800',
};

const PV_FIELDS = [
  { group: 'Show on chart', items: [
    { k: 'showZone', t: 'bool', l: 'CDC zone ribbon' },
    { k: 'showMA',   t: 'bool', l: 'MA lines' },
    { k: 'showEMA',  t: 'bool', l: 'EMA lines (dashed)' },
    { k: 'showIchi', t: 'bool', l: 'Ichimoku (cloud, lines, signals)' },
    { k: 'showSig',  t: 'bool', l: 'BUY / SELL labels' },
    { k: 'showTPSL', t: 'bool', l: 'TP / SL boxes' },
    { k: 'showConfl', t: 'bool', l: 'Confluence signals' },
    { k: 'showVP',   t: 'bool', l: 'Volume profile' },
    { k: 'showPoc',  t: 'bool', l: 'POC label' },
  ]},
  { group: 'Core EMA / MA', items: [
    { k: 'fastLen', t: 'int', l: 'EMA Fast', min: 1 }, { k: 'slowLen', t: 'int', l: 'EMA Slow', min: 1 },
    { k: 'ma1', t: 'int', l: 'MA 1', min: 1 }, { k: 'ma2', t: 'int', l: 'MA 2', min: 1 },
    { k: 'ma3', t: 'int', l: 'MA 3', min: 1 }, { k: 'ma4', t: 'int', l: 'MA 4', min: 1 },
    { k: 'ema1', t: 'int', l: 'EMA 1', min: 1 }, { k: 'ema2', t: 'int', l: 'EMA 2', min: 1 },
    { k: 'ema3', t: 'int', l: 'EMA 3', min: 1 }, { k: 'ema4', t: 'int', l: 'EMA 4', min: 1 },
  ]},
  { group: 'Ichimoku', items: [
    { k: 'ichiConvLen',  t: 'int', l: 'Conversion line periods', min: 1 },
    { k: 'ichiBaseLen',  t: 'int', l: 'Base line periods', min: 1 },
    { k: 'ichiSpan2Len', t: 'int', l: 'Lagging span 2 periods', min: 1 },
    { k: 'ichiDisp',     t: 'int', l: 'Displacement', min: 1, max: 100 },
  ]},
  { group: 'Strategy (ATR / TP / SL)', items: [
    { k: 'atrLen', t: 'int', l: 'ATR length', min: 1 },
    { k: 'tpMult', t: 'float', l: 'Take profit (ATR ×)', min: 0, step: 0.1 },
    { k: 'slMult', t: 'float', l: 'Stop loss (ATR ×)', min: 0, step: 0.1 },
    { k: 'boxLen', t: 'int', l: 'TP/SL box width (bars)', min: 1, max: 200 },
  ]},
  { group: 'Confluence filters', items: [
    { k: 'rsiLen', t: 'int', l: 'RSI length', min: 1 },
    { k: 'macdFast', t: 'int', l: 'MACD fast', min: 1 }, { k: 'macdSlow', t: 'int', l: 'MACD slow', min: 1 },
    { k: 'macdSig', t: 'int', l: 'MACD signal', min: 1 },
    { k: 'zLen', t: 'int', l: 'Z-score length', min: 2 },
    { k: 'adxLen', t: 'int', l: 'ADX length', min: 1 }, { k: 'adxSmooth', t: 'int', l: 'ADX smoothing', min: 1 },
    { k: 'adxThresh', t: 'int', l: 'ADX trend threshold', min: 1 },
    { k: 'obvSigLen', t: 'int', l: 'OBV signal EMA length', min: 1 },
    { k: 'gcFast', t: 'int', l: 'Golden cross fast MA', min: 1 }, { k: 'gcSlow', t: 'int', l: 'Golden cross slow MA', min: 1 },
  ]},
  { group: 'Layer toggles (counted in score)', items: [
    { k: 'useCDC', t: 'bool', l: 'CDC zone' }, { k: 'useMacd', t: 'bool', l: 'MACD' },
    { k: 'useAdx', t: 'bool', l: 'ADX trend' }, { k: 'useObv', t: 'bool', l: 'OBV volume' },
    { k: 'useRsi', t: 'bool', l: 'RSI' }, { k: 'useZ', t: 'bool', l: 'Z-score' },
    { k: 'useIchi', t: 'bool', l: 'Ichimoku' }, { k: 'useGC', t: 'bool', l: 'Golden cross' },
  ]},
  { group: 'Signal', items: [
    { k: 'buyThresh', t: 'int', l: 'BUY min score', min: 1, max: 8 },
    { k: 'sellThresh', t: 'int', l: 'SELL min |score|', min: 1, max: 8 },
  ]},
  { group: 'Volume profile', items: [
    { k: 'bbars', t: 'int', l: 'Number of bars (max = visible)', min: 1, max: 500 },
    { k: 'cnum', t: 'int', l: 'Row size', min: 5, max: 100 },
    { k: 'vpPercent', t: 'float', l: 'Value area volume %', min: 0, max: 100 },
    { k: 'pocColor', t: 'color', l: 'POC color' },
    { k: 'pocWidth', t: 'int', l: 'POC width', min: 1, max: 5 },
    { k: 'vupColor', t: 'color', l: 'Value area up' }, { k: 'vdownColor', t: 'color', l: 'Value area down' },
    { k: 'vpUpColor', t: 'color', l: 'Up volume' }, { k: 'vpDownColor', t: 'color', l: 'Down volume' },
  ]},
];

const PV_ZONE_COLOR = { g: '#00ff08', y: '#1900ff', b: '#ffff00', r: '#ff0000' }; // same (swapped) colors as the script
const PV_GREEN = '#00e676', PV_RED = '#ff5252';
const PV_LS_KEY = 'chartPineSettings';

function pvLoadSettings() {
  try { return { ...PV_DEFAULTS, ...JSON.parse(localStorage.getItem(PV_LS_KEY)) }; } catch { return { ...PV_DEFAULTS }; }
}
function pvSaveSettings(s) {
  try { localStorage.setItem(PV_LS_KEY, JSON.stringify(s)); } catch {}
}

// bars needed before the first visible bar so every indicator is seeded
function pvWarmup(S) {
  return Math.max(260, S.gcSlow + 60, S.ma4 + 60, S.ema4 + 60, S.ichiSpan2Len + S.ichiDisp + 60);
}

// ── Per-bar computation over a warm-up window ────────────────────────────────

function computePine(wb, S) {
  const n = wb.length, D = S.ichiDisp - 1;
  const high = wb.map(b => b.h ?? b.c), low = wb.map(b => b.l ?? b.c);
  const close = wb.map(b => b.c), vol = wb.map(b => b.v ?? 0);

  const emaF = taEma(close, S.fastLen), emaS = taEma(close, S.slowLen);
  const zone = close.map((c, i) => {
    const f = emaF[i], s = emaS[i];
    if (f == null || s == null) return null;
    return c > f ? (f > s ? 'g' : 'y') : (f < s ? 'r' : 'b');
  });

  const ma   = [S.ma1, S.ma2, S.ma3, S.ma4].map(p => taSma(close, p));
  const emas = [S.ema1, S.ema2, S.ema3, S.ema4].map(p => taEma(close, p));

  // Ichimoku
  const conv = taDonchian(high, low, S.ichiConvLen), base = taDonchian(high, low, S.ichiBaseLen);
  const spanB = taDonchian(high, low, S.ichiSpan2Len);
  const spanA = conv.map((v, i) => v != null && base[i] != null ? (v + base[i]) / 2 : null);
  const longCond = [], shortCond = [], buyCloud = [], sellCloud = [], ichiAbove = [], ichiBelow = [];
  let buymem = false, sellmem = false;
  for (let i = 0; i < n; i++) {
    const a = i - D >= 0 ? spanA[i - D] : null, b = i - D >= 0 ? spanB[i - D] : null;
    const ok = a != null && b != null && conv[i] != null && base[i] != null;
    const c = close[i];
    const ib = ok && c > high[i - D] && conv[i] > base[i] && c > a && c > b && low[i] > a && low[i] > b;
    const is = ok && c < low[i - D]  && conv[i] < base[i] && c < a && c < b && high[i] < a && high[i] < b;
    const pb = buymem, ps = sellmem;
    buymem  = ib ? true : is ? false : pb;
    sellmem = is ? true : ib ? false : ps;
    longCond[i] = ib && !pb;
    shortCond[i] = is && !ps;
    const cross = i > 0 && [spanA[i], spanB[i], spanA[i - 1], spanB[i - 1]].every(v => v != null);
    buyCloud[i]  = cross && spanA[i] > spanB[i] && spanA[i - 1] <= spanB[i - 1] && ok && low[i] > a && low[i] > b;
    sellCloud[i] = cross && spanA[i] < spanB[i] && spanA[i - 1] >= spanB[i - 1] && ok && high[i] < a && high[i] < b;
    ichiAbove[i] = ok && c > a && c > b && conv[i] > base[i];
    ichiBelow[i] = ok && c < a && c < b && conv[i] < base[i];
  }

  // Confluence score per bar (layer-toggle aware, as in the script)
  const rsi = taRsi(close, S.rsiLen);
  const { line: ml, signal: ms } = taMacd(close, S.macdFast, S.macdSlow, S.macdSig);
  const zMean = taSma(close, S.zLen), zStd = taStdev(close, S.zLen, zMean);
  const { plusDI, minusDI, adx } = taDmi(high, low, close, S.adxLen, S.adxSmooth);
  const obv = taObv(close, vol), obvSig = taEma(obv, S.obvSigLen);
  const gcF = taSma(close, S.gcFast), gcS = taSma(close, S.gcSlow);
  const isBuy = [], isSell = [], trendStrong = [];
  for (let i = 0; i < n; i++) {
    const z = zStd[i] ? (close[i] - zMean[i]) / zStd[i] : 0;
    const strong = adx[i] != null && adx[i] >= S.adxThresh;
    trendStrong[i] = strong;
    const total =
      (S.useCDC  ? (zone[i] === 'g' ? 1 : zone[i] === 'r' ? -1 : 0) : 0) +
      (S.useMacd ? (ml[i] != null && ms[i] != null && ml[i] > ms[i] ? 1 : -1) : 0) +
      (S.useAdx  ? (strong ? (plusDI[i] > minusDI[i] ? 1 : -1) : 0) : 0) +
      (S.useObv  ? (obv[i] > obvSig[i] ? 1 : -1) : 0) +
      (S.useRsi  ? (rsi[i] == null ? 0 : rsi[i] <= 60 ? 1 : rsi[i] <= 70 ? 0 : -1) : 0) +
      (S.useZ    ? (z <= 1.75 ? 1 : z <= 2 ? 0 : -1) : 0) +
      (S.useIchi ? (ichiAbove[i] ? 1 : ichiBelow[i] ? -1 : 0) : 0) +
      (S.useGC   ? (gcF[i] != null && gcS[i] != null && gcF[i] > gcS[i] ? 1 : -1) : 0);
    const veto = rsi[i] > 70 && z > 2;
    isBuy[i]  = total >= S.buyThresh && !veto;
    isSell[i] = total <= -S.sellThresh;
  }
  const confBuy  = isBuy.map((v, i) => v && !isBuy[i - 1] && !trendStrong[i]);
  const confSell = isSell.map((v, i) => v && !isSell[i - 1] && !trendStrong[i]);

  // CDC buy/sell signals with ATR-based TP/SL
  const tr = close.map((c, i) => i === 0 ? high[i] - low[i]
    : Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])));
  const atr = taRma(tr, S.atrLen);
  const sigs = [];
  let count = 0;
  for (let i = 1; i < n; i++) {
    const buy  = zone[i] === 'g' && zone[i - 1] !== 'g';
    const sell = zone[i] === 'r' && zone[i - 1] !== 'r';
    if (!buy && !sell) continue;
    count++;
    const a = atr[i] ?? 0, dir = buy ? 1 : -1;
    sigs.push({ i, buy, n: count, entry: close[i], tp: close[i] + dir * a * S.tpMult, sl: close[i] - dir * a * S.slMult });
  }

  return { zone, emaF, emaS, ma, emas, conv, base, spanA, spanB, close,
           longCond, shortCond, buyCloud, sellCloud, confBuy, confSell, sigs };
}

// ── Rendering ─────────────────────────────────────────────────────────────────
// c: { display, trim, n, extra, xOf, yOf, PAD, iW, iH, step, clipId }

function renderPine(pv, S, c) {
  const { display, trim, n, extra, xOf, yOf, PAD, iW, iH, step, clipId } = c;
  const D = S.ichiDisp - 1, total = n + extra;
  const f = v => v.toFixed(1);
  const at = (arr, off) => k => { const v = arr[k + trim + (off || 0)]; return v == null ? null : v; };

  function path(fn, len) {
    let d = '', pen = false;
    for (let k = 0; k < len; k++) {
      const v = fn(k);
      if (v == null) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + f(xOf(k)) + ' ' + f(yOf(v)); pen = true;
    }
    return d;
  }
  function band(a, b, colorOf, opacity, len, key) {
    const paths = {};
    for (let k = 1; k < len; k++) {
      const a0 = a(k - 1), a1 = a(k), b0 = b(k - 1), b1 = b(k);
      if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
      const col = colorOf(k);
      if (!col) continue;
      paths[col] = (paths[col] || '') +
        `M${f(xOf(k - 1))} ${f(yOf(a0))}L${f(xOf(k))} ${f(yOf(a1))}L${f(xOf(k))} ${f(yOf(b1))}L${f(xOf(k - 1))} ${f(yOf(b0))}Z`;
    }
    return Object.entries(paths).map(([col, d]) => <path key={key + col} d={d} fill={col} fillOpacity={opacity} />);
  }
  const line = (key, fn, len, color, w, dash) => {
    const d = path(fn, len);
    return d ? <path key={key} d={d} fill="none" stroke={color} strokeWidth={w || 1} strokeDasharray={dash} /> : null;
  };

  const back = [], front = [];

  // CDC zone ribbon
  if (S.showZone) {
    back.push(...band(at(pv.emaF), at(pv.emaS), k => PV_ZONE_COLOR[pv.zone[k + trim]], 0.3, n, 'zone'));
  }

  // Ichimoku cloud
  if (S.showIchi) {
    const sa = at(pv.spanA, -D), sb = at(pv.spanB, -D);
    back.push(...band(sa, sb, k => sa(k) > sb(k) ? '#4caf50' : '#f44336', 0.2, total, 'cloud'));
  }

  // Volume profile over the last min(bbars, visible) bars
  if (S.showVP) {
    const vpN = Math.min(S.bbars, n), k0 = n - vpN, rows = S.cnum;
    const vb = display.slice(k0);
    const top = Math.max(...vb.map(b => b.h ?? b.c)), bot = Math.min(...vb.map(b => b.l ?? b.c));
    const stepP = (top - bot) / rows;
    if (stepP > 0 && vb.some(b => b.v)) {
      const lv = Array.from({ length: rows + 1 }, (_, x) => bot + stepP * x);
      const ov = (a1, a2, b1, b2, h, v) => {
        const o = Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
        return h > 0 ? Math.max(o, 0) * v / h : 0;
      };
      const up = new Array(rows).fill(0), dn = new Array(rows).fill(0);
      for (const b of vb) {
        const o = b.o ?? b.c, bt = Math.max(o, b.c), bb = Math.min(o, b.c), hi = b.h ?? b.c, lo = b.l ?? b.c;
        const tw = hi - bt, bw = bb - lo, body = bt - bb, den = 2 * tw + 2 * bw + body;
        if (!den || !b.v) continue;
        const bodyV = body * b.v / den, twV = 2 * tw * b.v / den, bwV = 2 * bw * b.v / den, green = b.c >= o;
        for (let x = 0; x < rows; x++) {
          const wick = ov(lv[x], lv[x + 1], bt, hi, tw, twV) / 2 + ov(lv[x], lv[x + 1], bb, lo, bw, bwV) / 2;
          const bd = ov(lv[x], lv[x + 1], bb, bt, body, bodyV);
          up[x] += (green ? bd : 0) + wick;
          dn[x] += (green ? 0 : bd) + wick;
        }
      }
      const tot = up.map((v, x) => v + dn[x]), maxV = Math.max(...tot);
      const poc = tot.indexOf(maxV);
      const target = tot.reduce((a, b) => a + b, 0) * S.vpPercent / 100;
      let vaT = tot[poc], hiX = poc, loX = poc;
      for (let i = 0; i < rows && vaT < target; i++) {
        const u = hiX < rows - 1 ? tot[hiX + 1] : 0, d = loX > 0 ? tot[loX - 1] : 0;
        if (!u && !d) break;
        if (u >= d) { vaT += u; hiX++; } else { vaT += d; loX--; }
      }
      const x0 = xOf(k0) - step / 2, wpx = v => v * vpN / (3 * maxV) * step;
      for (let x = 0; x < rows; x++) {
        const yTop = yOf(lv[x + 1]), h = Math.max(1, yOf(lv[x]) - yTop - 0.6), inVA = x >= loX && x <= hiX;
        const wu = wpx(up[x]), wd = wpx(dn[x]);
        back.push(<rect key={'vu' + x} x={f(x0)} y={f(yTop)} width={f(wu)} height={f(h)}
                        fill={inVA ? S.vupColor : S.vpUpColor} fillOpacity={inVA ? 0.7 : 0.25} />);
        back.push(<rect key={'vd' + x} x={f(x0 + wu)} y={f(yTop)} width={f(wd)} height={f(h)}
                        fill={inVA ? S.vdownColor : S.vpDownColor} fillOpacity={inVA ? 0.7 : 0.25} />);
      }
      const pocP = (lv[poc] + lv[poc + 1]) / 2, py = yOf(pocP);
      front.push(<line key="poc" x1={f(x0)} x2={f(PAD.l + iW)} y1={f(py)} y2={f(py)} stroke={S.pocColor} strokeWidth={S.pocWidth} />);
      if (S.showPoc) {
        front.push(<text key="poclbl" x={f(PAD.l + iW - 3)} y={f(py - 3)} textAnchor="end" fontSize="9" fontWeight="700"
                         fontFamily="var(--font-mono)" fill={S.pocColor}>POC: {fmtChartPrice(pocP)}</text>);
      }
    }
  }

  // CDC buy/sell labels with ATR TP/SL boxes
  if (S.showSig) {
    pv.sigs.forEach(s => {
      const k = s.i - trim;
      if (k < 0 || k >= n) return;
      const b = display[k], x = xOf(k), x1 = xOf(k + S.boxLen);
      const col = s.buy ? PV_GREEN : PV_RED;
      if (S.showTPSL) {
        const yEntry = yOf(s.entry), yTp = yOf(s.tp), ySl = yOf(s.sl);
        const box = (ya, yb, color, key) => (
          <rect key={key} x={f(x)} y={f(Math.min(ya, yb))} width={f(x1 - x)} height={f(Math.abs(ya - yb))}
                fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" strokeDasharray="4 3" />);
        back.push(box(yEntry, yTp, PV_GREEN, 'tp' + s.i), box(yEntry, ySl, PV_RED, 'sl' + s.i));
        front.push(<line key={'en' + s.i} x1={f(x)} x2={f(x1)} y1={f(yEntry)} y2={f(yEntry)} stroke="var(--fg-2)" strokeWidth="1.5" />);
        [['● ENTRY', s.entry, yEntry, 'var(--fg-2)'], ['TP', s.tp, yTp, PV_GREEN], ['SL', s.sl, ySl, PV_RED]].forEach(([t, v, y, tc]) =>
          front.push(<text key={t + s.i} x={f(x1 + 3)} y={f(y + 3)} fontSize="8.5" fontFamily="var(--font-mono)" fill={tc}>{t} {s.n} ({fmtChartPrice(v)})</text>));
      }
      const ly = s.buy ? yOf(b.l ?? b.c) + 6 : yOf(b.h ?? b.c) - 20;
      front.push(<g key={'lb' + s.i}>
        <rect x={f(x - 19)} y={f(ly)} width="38" height="14" rx="3" fill={col} />
        <text x={f(x)} y={f(ly + 10)} textAnchor="middle" fontSize="9" fontWeight="700" fill={s.buy ? '#000' : '#fff'}>{s.buy ? 'BUY' : 'SELL'} {s.n}</text>
      </g>);
    });
  }

  // Ichimoku lines
  if (S.showIchi) {
    front.push(line('conv', at(pv.conv), n, '#0496ff', 1));
    front.push(line('base', at(pv.base), n, '#991515', 1));
    front.push(line('lag', k => pv.close[k + trim + D] ?? null, n, '#459915', 1));
    front.push(line('spa', at(pv.spanA, -D), total, '#4caf50', 1));
    front.push(line('spb', at(pv.spanB, -D), total, '#f44336', 1));
  }

  // MA (solid) and EMA (dashed)
  const MA_COL = ['#4caf50', '#2196f3', '#fdd835', '#f44336'];
  if (S.showMA)  pv.ma.forEach((s, i)   => front.push(line('ma' + i,  at(s), n, MA_COL[i], 1)));
  if (S.showEMA) pv.emas.forEach((s, i) => front.push(line('ema' + i, at(s), n, MA_COL[i], 1, '4 3')));

  // Triangle markers
  const marker = (key, k, buy, size, offset, text) => {
    const b = display[k], x = xOf(k), col = buy ? PV_GREEN : PV_RED;
    const y = buy ? yOf(b.l ?? b.c) + offset : yOf(b.h ?? b.c) - offset;
    const tri = buy ? `${f(x)},${f(y)} ${f(x - size)},${f(y + size * 1.4)} ${f(x + size)},${f(y + size * 1.4)}`
                    : `${f(x)},${f(y)} ${f(x - size)},${f(y - size * 1.4)} ${f(x + size)},${f(y - size * 1.4)}`;
    front.push(<g key={key}>
      <polygon points={tri} fill={col} />
      <text x={f(x)} y={f(buy ? y + size * 1.4 + 9 : y - size * 1.4 - 3)} textAnchor="middle" fontSize="8" fontWeight="700" fill={col}>{text}</text>
    </g>);
  };
  for (let k = 0; k < n; k++) {
    const w = k + trim;
    if (S.showIchi) {
      if (pv.longCond[w])  marker('lc' + k, k, true,  4, 4, 'BUY');
      if (pv.shortCond[w]) marker('sc' + k, k, false, 4, 4, 'Sell');
      if (pv.buyCloud[w])  marker('bc' + k, k, true,  3, 4, 'BUY');
      if (pv.sellCloud[w]) marker('xc' + k, k, false, 3, 4, 'Sell');
    }
    if (S.showConfl) {
      if (pv.confBuy[w])  marker('cb' + k, k, true,  6, 22, 'BUY');
      if (pv.confSell[w]) marker('cs' + k, k, false, 6, 22, 'SELL');
    }
  }

  const wrap = (key, kids) => (
    <g key={key} clipPath={`url(#${clipId})`} style={{ pointerEvents: 'none' }}>{kids}</g>
  );
  return {
    defs: <clipPath id={clipId}><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>,
    back: wrap('pback', back), front: wrap('pfront', front),
  };
}

// ── Settings panel ────────────────────────────────────────────────────────────

function PineSettingsPanel({ S, onChange, onReset, onClose }) {
  const [resetKey, setResetKey] = React.useState(0);
  const cell = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'var(--fg-2)', minHeight: 28, borderBottom: '1px solid var(--border-1)', cursor: 'pointer' };
  const input = { width: 64, fontSize: 11.5, padding: '2px 4px', border: '1px solid var(--border-2)', borderRadius: 6, background: 'var(--bg-surface)', color: 'var(--fg-1)', textAlign: 'right' };

  function field(it) {
    const v = S[it.k];
    if (it.t === 'bool') {
      return <input type="checkbox" checked={!!v} onChange={e => onChange({ [it.k]: e.target.checked })} />;
    }
    if (it.t === 'color') {
      return <input type="color" key={resetKey} value={v} onChange={e => onChange({ [it.k]: e.target.value })}
                    style={{ width: 34, height: 22, padding: 0, border: '1px solid var(--border-2)', borderRadius: 4, background: 'none' }} />;
    }
    return (
      <input type="number" key={resetKey} defaultValue={v} step={it.step || 1} min={it.min} max={it.max} style={input}
             onChange={e => {
               let x = it.t === 'int' ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
               if (Number.isNaN(x)) return;
               if (it.min != null) x = Math.max(it.min, x);
               if (it.max != null) x = Math.min(it.max, x);
               onChange({ [it.k]: x });
             }} />
    );
  }

  return (
    <div style={{ border: '1px solid var(--border-2)', borderRadius: 10, background: 'var(--bg-surface)', margin: '4px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-1)' }}>
        <b style={{ fontSize: 12, flex: 1 }}>CDC Pro settings</b>
        <button onClick={() => { onReset(); setResetKey(k => k + 1); }}
                style={{ fontSize: 11, padding: '2px 9px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-2)', background: 'var(--bg-surface)', color: 'var(--fg-3)' }}>
          Reset defaults
        </button>
        <button onClick={onClose} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-2)', background: 'var(--bg-surface)', color: 'var(--fg-3)' }}>
          Close
        </button>
      </div>
      <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '4px 12px 10px' }}>
        {PV_FIELDS.map(g => (
          <div key={g.group}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--fg-4)', margin: '10px 0 4px' }}>{g.group}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', columnGap: 28 }}>
              {g.items.map(it => (
                it.t === 'bool'
                  ? <label key={it.k} style={{ ...cell, justifyContent: 'flex-start' }}>{field(it)}<span>{it.l}</span></label>
                  : <label key={it.k} style={cell}><span>{it.l}</span>{field(it)}</label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.PV_DEFAULTS = PV_DEFAULTS;
window.pvLoadSettings = pvLoadSettings;
window.pvSaveSettings = pvSaveSettings;
window.pvWarmup = pvWarmup;
window.computePine = computePine;
window.renderPine = renderPine;
window.PineSettingsPanel = PineSettingsPanel;
