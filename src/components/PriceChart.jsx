/* eslint-disable */
/* PriceChart.jsx — Historical price chart modal + shared CandleChart component */

const CHART_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const RANGE_OPTS = [
  { label: '1D',  range: '1d'  },
  { label: '5D',  range: '5d'  },
  { label: '1M',  range: '1mo' },
  { label: '6M',  range: '6mo' },
  { label: 'YTD', range: 'ytd' },
  { label: '1Y',  range: '1y'  },
  { label: '5Y',  range: '5y'  },
  { label: 'Max', range: 'max' },
];

function resolveChartSymbol(classKey, name) {
  const cls = (window.ASSET_CLASSES || []).find(c => c.key === classKey);
  if (!cls || !cls.live || cls.live === 'settrade') return null;
  if (cls.yahooSymbol) return cls.yahooSymbol; // e.g. GC=F for gold
  if (cls.live === 'crypto') {
    const entry = (window.CRYPTO_MAP || {})[name];
    return entry ? `${entry.sym}-USD` : null;
  }
  return name + (cls.yahooSuffix || '');
}

function getCachedChart(symbol, range) {
  try {
    const raw = localStorage.getItem(`price_chart_${symbol}_${range}`);
    if (!raw) return null;
    const { d, ts } = JSON.parse(raw);
    if (Date.now() - ts > CHART_CACHE_TTL) return null;
    return { data: d, ts };
  } catch { return null; }
}

function setCachedChart(symbol, range, data) {
  try {
    localStorage.setItem(`price_chart_${symbol}_${range}`, JSON.stringify({ d: data, ts: Date.now() }));
  } catch {}
}

function fmtChartDate(ts, range) {
  const d = new Date(ts);
  if (range === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (range === '5d') return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (range === '5y' || range === 'max') return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtChartDateFull(ts, range) {
  const d = new Date(ts);
  if (range === '1d') return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtChartPrice(v, decimals) {
  if (v == null) return '—';
  const d = decimals != null ? decimals : v >= 1000 ? 2 : v >= 10 ? 2 : v >= 1 ? 4 : 6;
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Indicator helpers (EMA, RSI, MACD) ───────────────────────────────────────

function _iEma(data, period) {
  const k = 2 / (period + 1);
  const out = new Array(data.length).fill(null);
  let i = 0;
  while (i < data.length && data[i] == null) i++;
  if (i >= data.length) return out;
  out[i] = data[i];
  for (let j = i + 1; j < data.length; j++) {
    out[j] = data[j] != null ? data[j] * k + out[j - 1] * (1 - k) : out[j - 1];
  }
  return out;
}

function _iRsi(close, period) {
  const out = new Array(close.length).fill(null);
  if (close.length <= period) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) { const d = close[i] - close[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= period; l /= period;
  out[period] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = period + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    g = (g * (period - 1) + Math.max(d, 0)) / period;
    l = (l * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

function _iMacd(close, fast, slow, sig) {
  const ef = _iEma(close, fast), es = _iEma(close, slow);
  const line = ef.map((v, i) => v != null && es[i] != null ? v - es[i] : null);
  const signal = _iEma(line, sig);
  const hist = line.map((v, i) => v != null && signal[i] != null ? v - signal[i] : null);
  return { line, signal, hist };
}

function _linePath(vals, xOf, yOf) {
  let d = '';
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] == null) continue;
    d += (d === '' ? 'M' : 'L') + xOf(i).toFixed(1) + ' ' + yOf(vals[i]).toFixed(1) + ' ';
  }
  return d;
}

// ── Shared Candle Chart (used by TechnicalAnalysis too via window.CandleChart) ─

function CandleChart({ bars, daysBack }) {
  const [hoverIdx,   setHoverIdx]   = React.useState(null);
  const [showInds,   setShowInds]   = React.useState(false);
  const svgRef = React.useRef(null);

  // bars: { t (ms), o, h, l, c, v? }  — t in milliseconds
  const display = bars.slice(-(daysBack || bars.length));
  if (!display.length) return <div className="linechart-empty">No candle data.</div>;

  const W = 680, H = 220;
  const PAD = { t: 10, r: 10, b: 28, l: 64 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const yMax = Math.max(...display.map(b => b.h || b.c));
  const yMin = Math.min(...display.map(b => b.l || b.c));
  const ySpan = (yMax - yMin) || yMax * 0.02 || 1;
  const yPad  = ySpan * 0.08;
  const yLo   = yMin - yPad;
  const yHi   = yMax + yPad;
  const yRange = yHi - yLo;

  const n    = display.length;
  const step = iW / n;
  const cw   = Math.max(2, step * 0.6);

  const xOf  = i => PAD.l + i * step + step / 2;
  const yOf  = v => PAD.t + (1 - (v - yLo) / yRange) * iH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.t + (1 - f) * iH,
    v: yLo + f * yRange,
  }));

  // Month labels for x-axis
  const xLabels = [];
  let lastMon = -1;
  for (let i = 0; i < n; i++) {
    const d = new Date(display[i].t);
    const m = d.getMonth();
    if (m !== lastMon) { xLabels.push({ i, label: d.toLocaleString([], { month: 'short' }) }); lastMon = m; }
  }

  // ── Indicators computed over display slice ──────────────────────────────
  const closes = display.map(b => b.c);
  const ema20  = _iEma(closes, 20);
  const ema50  = _iEma(closes, 50);
  const ema100 = _iEma(closes, 100);
  const ema200 = _iEma(closes, 200);
  const rsi14  = _iRsi(closes, 14);
  const macd   = _iMacd(closes, 12, 26, 9);

  const EMA_LINES = [
    { data: ema20,  color: '#2979ff', label: 'EMA20'  },
    { data: ema50,  color: '#ff9800', label: 'EMA50'  },
    { data: ema100, color: '#e91e63', label: 'EMA100' },
    { data: ema200, color: '#9c27b0', label: 'EMA200' },
  ];

  // RSI sub-chart layout
  const RSI_H = 80, RSI_PAD = { t: 6, b: 16, l: 64, r: 10 };
  const RSI_iH = RSI_H - RSI_PAD.t - RSI_PAD.b;
  const rsiY = v => RSI_PAD.t + (1 - (v - 0) / 100) * RSI_iH;

  // MACD sub-chart layout
  const MACD_H = 70, MACD_PAD = { t: 6, b: 16, l: 64, r: 10 };
  const MACD_iH = MACD_H - MACD_PAD.t - MACD_PAD.b;
  const macdVals = macd.hist.filter(v => v != null);
  const macdMax  = macdVals.length ? Math.max(...macdVals.map(Math.abs)) * 1.2 || 1 : 1;
  const macdY    = v => MACD_PAD.t + (1 - (v + macdMax) / (2 * macdMax)) * MACD_iH;

  const hovered = hoverIdx != null ? display[hoverIdx] : null;

  return (
    <div>
      {/* ── Tip row + Indicators toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <div className="price-chart-tip" style={{ flex: 1, marginBottom: 0 }}>
          {hovered ? (
            <>
              <span className="price-chart-tip-date">
                {new Date(hovered.t).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 4 }}>
                O:{fmtChartPrice(hovered.o)} H:{fmtChartPrice(hovered.h)} L:{fmtChartPrice(hovered.l)}
              </span>
              <span className="price-chart-tip-val"
                    style={{ color: hovered.c >= (hovered.o || hovered.c) ? 'var(--green-600)' : 'var(--red-600)' }}>
                C:{fmtChartPrice(hovered.c)}
              </span>
              {showInds && hoverIdx != null && (
                <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 8 }}>
                  RSI:{rsi14[hoverIdx] != null ? rsi14[hoverIdx].toFixed(1) : '—'}
                  {macd.hist[hoverIdx] != null && ` MACD:${macd.hist[hoverIdx].toFixed(3)}`}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>{n} candles · hover to inspect</span>
          )}
        </div>
        <button
          onClick={() => setShowInds(v => !v)}
          style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
            background: showInds ? 'var(--bg-selected)' : 'var(--bg-surface)',
            border: '1px solid ' + (showInds ? 'var(--accent)' : 'var(--border-2)'),
            color: showInds ? 'var(--accent)' : 'var(--fg-3)',
          }}>
          Indicators
        </button>
      </div>

      {/* ── EMA Legend (when indicators on) ── */}
      {showInds && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          {EMA_LINES.map(e => (
            <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 18, height: 2, background: e.color, borderRadius: 1 }} />
              <span style={{ color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>
                {e.label}
                {hoverIdx != null && e.data[hoverIdx] != null ? ` ${fmtChartPrice(e.data[hoverIdx])}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Main candle SVG ── */}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="linechart-svg"
        onMouseMove={e => {
          const svg = svgRef.current;
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          const mx = (e.clientX - rect.left) * (W / rect.width) - PAD.l;
          setHoverIdx(Math.max(0, Math.min(n - 1, Math.floor(mx / step))));
        }}
        onMouseLeave={() => setHoverIdx(null)}>

        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y.toFixed(1)} y2={tk.y.toFixed(1)}
                  stroke="var(--border-1)" strokeWidth="0.8" strokeDasharray="3 5" />
            <text x={PAD.l - 6} y={tk.y + 4} textAnchor="end" fontSize="9.5"
                  fill="var(--fg-4)" fontFamily="var(--font-mono)">
              {fmtChartPrice(tk.v)}
            </text>
          </g>
        ))}

        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + iH} y2={PAD.t + iH}
              stroke="var(--border-2)" strokeWidth="0.8" />

        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i).toFixed(1)} y={H - 4} textAnchor="middle"
                fontSize="9.5" fill="var(--fg-4)" fontFamily="var(--font-mono)">
            {label}
          </text>
        ))}

        {display.map((b, i) => {
          const up  = b.c >= (b.o ?? b.c);
          const col = up ? 'var(--green-600)' : 'var(--red-600)';
          const cx  = xOf(i);
          const bTop = yOf(Math.max(b.o ?? b.c, b.c));
          const bBot = yOf(Math.min(b.o ?? b.c, b.c));
          const bH   = Math.max(1, bBot - bTop);
          return (
            <g key={i}>
              <line x1={cx.toFixed(1)} x2={cx.toFixed(1)}
                    y1={yOf(b.h ?? b.c).toFixed(1)} y2={yOf(b.l ?? b.c).toFixed(1)}
                    stroke={col} strokeWidth={i === hoverIdx ? 1.5 : 0.9} />
              <rect x={(cx - cw / 2).toFixed(1)} y={bTop.toFixed(1)}
                    width={cw.toFixed(1)} height={bH.toFixed(1)}
                    fill={col} opacity={i === hoverIdx ? 1 : 0.85} />
            </g>
          );
        })}

        {/* EMA overlays */}
        {showInds && EMA_LINES.map(e => {
          const d = _linePath(e.data, xOf, yOf);
          return d ? <path key={e.label} d={d} fill="none" stroke={e.color} strokeWidth="1.2" opacity="0.85" /> : null;
        })}

        {hoverIdx != null && (
          <line x1={xOf(hoverIdx).toFixed(1)} x2={xOf(hoverIdx).toFixed(1)}
                y1={PAD.t} y2={PAD.t + iH}
                stroke="var(--fg-3)" strokeWidth="0.8" strokeDasharray="3 4" />
        )}
      </svg>

      {/* ── RSI sub-chart ── */}
      {showInds && (
        <svg viewBox={`0 0 ${W} ${RSI_H}`} className="linechart-svg" style={{ marginTop: 2, cursor: 'default' }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (W / rect.width) - RSI_PAD.l;
            setHoverIdx(Math.max(0, Math.min(n - 1, Math.floor(mx / step))));
          }}
          onMouseLeave={() => setHoverIdx(null)}>
          {/* Background */}
          <rect x={RSI_PAD.l} y={RSI_PAD.t} width={iW} height={RSI_iH} fill="none" />

          {/* Reference lines: 70, 50, 30 */}
          {[70, 50, 30].map(v => (
            <g key={v}>
              <line x1={RSI_PAD.l} x2={W - RSI_PAD.r} y1={rsiY(v).toFixed(1)} y2={rsiY(v).toFixed(1)}
                    stroke={v === 50 ? 'var(--border-2)' : v === 70 ? 'var(--red-600)' : 'var(--green-600)'}
                    strokeWidth="0.6" strokeDasharray="3 4" opacity="0.6" />
              <text x={RSI_PAD.l - 4} y={rsiY(v) + 3} textAnchor="end" fontSize="8"
                    fill={v === 70 ? 'var(--red-600)' : v === 30 ? 'var(--green-600)' : 'var(--fg-4)'}
                    fontFamily="var(--font-mono)">
                {v}
              </text>
            </g>
          ))}

          {/* RSI label */}
          <text x={RSI_PAD.l + 2} y={RSI_PAD.t + 10} fontSize="8" fill="var(--fg-4)" fontFamily="var(--font-mono)" fontWeight="600">RSI(14)</text>

          {/* RSI line */}
          {(() => {
            const d = _linePath(rsi14, xOf, rsiY);
            return d ? <path d={d} fill="none" stroke="#ff9f0a" strokeWidth="1.2" /> : null;
          })()}

          {/* Overbought/oversold fill */}
          {rsi14.map((v, i) => {
            if (v == null) return null;
            const col = v >= 70 ? 'rgba(255,69,58,0.15)' : v <= 30 ? 'rgba(48,209,88,0.15)' : null;
            if (!col) return null;
            return <rect key={i} x={(xOf(i) - step / 2).toFixed(1)} y={RSI_PAD.t} width={step.toFixed(1)} height={RSI_iH} fill={col} />;
          })}

          {hoverIdx != null && (
            <line x1={xOf(hoverIdx).toFixed(1)} x2={xOf(hoverIdx).toFixed(1)}
                  y1={RSI_PAD.t} y2={RSI_PAD.t + RSI_iH}
                  stroke="var(--fg-3)" strokeWidth="0.8" strokeDasharray="3 4" />
          )}
        </svg>
      )}

      {/* ── MACD sub-chart ── */}
      {showInds && (
        <svg viewBox={`0 0 ${W} ${MACD_H}`} className="linechart-svg" style={{ marginTop: 2, cursor: 'default' }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (W / rect.width) - MACD_PAD.l;
            setHoverIdx(Math.max(0, Math.min(n - 1, Math.floor(mx / step))));
          }}
          onMouseLeave={() => setHoverIdx(null)}>
          {/* Zero line */}
          <line x1={MACD_PAD.l} x2={W - MACD_PAD.r}
                y1={macdY(0).toFixed(1)} y2={macdY(0).toFixed(1)}
                stroke="var(--border-2)" strokeWidth="0.6" />

          {/* MACD label */}
          <text x={MACD_PAD.l + 2} y={MACD_PAD.t + 10} fontSize="8" fill="var(--fg-4)" fontFamily="var(--font-mono)" fontWeight="600">MACD(12,26,9)</text>

          {/* Histogram bars */}
          {macd.hist.map((v, i) => {
            if (v == null) return null;
            const yz = macdY(0);
            const yv = macdY(v);
            const barH = Math.abs(yz - yv);
            return (
              <rect key={i}
                    x={(xOf(i) - cw / 2).toFixed(1)} y={Math.min(yz, yv).toFixed(1)}
                    width={Math.max(1, cw).toFixed(1)} height={Math.max(0.5, barH).toFixed(1)}
                    fill={v >= 0 ? 'rgba(48,209,88,0.6)' : 'rgba(255,69,58,0.6)'} />
            );
          })}

          {/* MACD line */}
          {(() => {
            const d = _linePath(macd.line, xOf, macdY);
            return d ? <path d={d} fill="none" stroke="#2979ff" strokeWidth="1.1" /> : null;
          })()}

          {/* Signal line */}
          {(() => {
            const d = _linePath(macd.signal, xOf, macdY);
            return d ? <path d={d} fill="none" stroke="#ff9800" strokeWidth="1.1" /> : null;
          })()}

          {/* Y axis label */}
          <text x={MACD_PAD.l - 4} y={MACD_PAD.t + 4} textAnchor="end" fontSize="7.5" fill="var(--fg-4)" fontFamily="var(--font-mono)">
            {(macdMax).toFixed(3)}
          </text>
          <text x={MACD_PAD.l - 4} y={MACD_PAD.t + MACD_iH + 4} textAnchor="end" fontSize="7.5" fill="var(--fg-4)" fontFamily="var(--font-mono)">
            {(-macdMax).toFixed(3)}
          </text>

          {hoverIdx != null && (
            <line x1={xOf(hoverIdx).toFixed(1)} x2={xOf(hoverIdx).toFixed(1)}
                  y1={MACD_PAD.t} y2={MACD_PAD.t + MACD_iH}
                  stroke="var(--fg-3)" strokeWidth="0.8" strokeDasharray="3 4" />
          )}
        </svg>
      )}

      {/* MACD legend */}
      {showInds && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
          {[
            { color: '#2979ff', label: 'MACD line' },
            { color: '#ff9800', label: 'Signal (9)' },
            { color: 'rgba(48,209,88,0.7)', label: 'Hist ↑' },
            { color: 'rgba(255,69,58,0.7)', label: 'Hist ↓' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: 'var(--fg-3)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Line chart (price modal) ──────────────────────────────────────────────────

function PriceLineChart({ points, range }) {
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const svgRef = React.useRef(null);
  const [gradId] = React.useState(() => 'pcg' + Math.random().toString(36).slice(2, 8));

  if (!points || points.length < 2) {
    return (
      <div className="linechart-empty">No chart data available for this range.</div>
    );
  }

  const W = 600, H = 210;
  const PAD = { t: 10, r: 10, b: 28, l: 64 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const closes = points.map(p => p.c);
  const minRaw = Math.min(...closes);
  const maxRaw = Math.max(...closes);
  const span = (maxRaw - minRaw) || maxRaw * 0.02 || 1;
  const pad  = span * 0.12;
  const yMin = minRaw - pad;
  const yMax = maxRaw + pad;
  const ySpan = yMax - yMin;

  const xOf = i => PAD.l + (i / (points.length - 1)) * iW;
  const yOf = v => PAD.t + (1 - (v - yMin) / ySpan) * iH;

  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)} ${yOf(p.c).toFixed(1)}`).join(' ');
  const areaD = lineD
    + ` L${xOf(points.length - 1).toFixed(1)} ${(PAD.t + iH).toFixed(1)}`
    + ` L${PAD.l.toFixed(1)} ${(PAD.t + iH).toFixed(1)} Z`;

  const isUp  = closes[closes.length - 1] >= closes[0];
  const color = isUp ? 'var(--green-600)' : 'var(--red-600)';

  const yTicks = [0, 0.33, 0.67, 1].map(f => ({
    y: PAD.t + (1 - f) * iH,
    v: yMin + f * ySpan,
  }));

  const xStep = Math.max(1, Math.floor(points.length / 4));
  const xTicks = [];
  for (let i = 0; i < points.length; i += xStep) {
    if (xTicks.length < 5) xTicks.push(i);
  }
  if (xTicks[xTicks.length - 1] !== points.length - 1) xTicks.push(points.length - 1);

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  function onMouseMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(xOf(i) - mx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    setHoverIdx(best);
  }

  return (
    <div>
      <div className="price-chart-tip">
        {hovered ? (
          <>
            <span className="price-chart-tip-date">{fmtChartDateFull(hovered.t, range)}</span>
            <span className="price-chart-tip-val">{fmtChartPrice(hovered.c)}</span>
          </>
        ) : (
          <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>Hover to inspect</span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="linechart-svg"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={isUp ? 'var(--green-600)' : 'var(--red-600)'} stopOpacity="0.20" />
            <stop offset="100%" stopColor={isUp ? 'var(--green-600)' : 'var(--red-600)'} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y.toFixed(1)} y2={tk.y.toFixed(1)}
                  stroke="var(--border-1)" strokeWidth="0.8" strokeDasharray="3 5" />
            <text x={PAD.l - 6} y={tk.y + 4} textAnchor="end" fontSize="9.5"
                  fill="var(--fg-4)" fontFamily="var(--font-mono)">
              {fmtChartPrice(tk.v)}
            </text>
          </g>
        ))}

        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + iH} y2={PAD.t + iH}
              stroke="var(--border-2)" strokeWidth="0.8" />

        {xTicks.map((idx, i) => {
          const anchor = i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle';
          return (
            <text key={idx} x={xOf(idx).toFixed(1)} y={H - 4} textAnchor={anchor}
                  fontSize="9.5" fill="var(--fg-4)" fontFamily="var(--font-mono)">
              {fmtChartDate(points[idx].t, range)}
            </text>
          );
        })}

        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />

        {hovered && (
          <g>
            <line x1={xOf(hoverIdx).toFixed(1)} x2={xOf(hoverIdx).toFixed(1)}
                  y1={PAD.t} y2={PAD.t + iH}
                  stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 4" />
            <circle cx={xOf(hoverIdx).toFixed(1)} cy={yOf(hovered.c).toFixed(1)} r="4"
                    fill={color} stroke="var(--bg-surface)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function PriceChartModal({ classKey, name, onClose }) {
  const symbol = resolveChartSymbol(classKey, name);
  const [rangeIdx, setRangeIdx] = React.useState(2); // default 1M
  const [chartData, setChartData]   = React.useState(null);
  const [loading, setLoading]       = React.useState(false);
  const [error, setError]           = React.useState(null);
  const [cachedAt, setCachedAt]     = React.useState(null);
  const [chartType, setChartType]   = React.useState('line'); // 'line' | 'candle'

  const opt = RANGE_OPTS[rangeIdx];

  async function load(force) {
    if (!symbol) return;
    if (!force) {
      const cached = getCachedChart(symbol, opt.range);
      if (cached) { setChartData(cached.data); setCachedAt(cached.ts); return; }
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${opt.range}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      setCachedChart(symbol, opt.range, j);
      setChartData(j);
      setCachedAt(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { if (symbol) load(false); }, [symbol, rangeIdx]);

  const cls        = (window.ASSET_CLASSES || []).find(c => c.key === classKey) || {};
  const points     = chartData?.points || [];
  const price      = chartData?.price;
  const ccy        = chartData?.currency || cls.ccy || '';
  const lastClose  = points[points.length - 1]?.c ?? price;

  // Fix: use prevClose from API for accurate day change on 1D range
  const baseline = opt.range === '1d'
    ? (chartData?.prevClose ?? points[0]?.c)
    : points[0]?.c;
  const change     = lastClose != null && baseline != null ? lastClose - baseline : null;
  const changePct  = change != null && baseline ? (change / baseline) * 100 : null;
  const isUp       = change == null ? null : change >= 0;

  const displayName = classKey === 'crypto' ? name.replace(/THB$/, '') : name;

  function fmtAgo(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  if (!symbol) {
    return (
      <Modal open onClose={onClose} title={`${displayName} — Price Chart`} width={600}>
        <div className="banner-soft">
          <Icon name="info" size={15} />
          <span>Historical price chart is not available for Thai mutual funds (settrade NAV data only). Use the refresh prices button to update the current NAV.</span>
        </div>
      </Modal>
    );
  }

  // For candle chart, convert points to candle-compatible format (t already in ms)
  const candleBars = points.filter(p => p.h != null && p.l != null && p.o != null);

  return (
    <Modal open onClose={onClose}
           title={displayName}
           subtitle={`${cls.label || classKey} · ${symbol}`}
           width={700}>

      {/* Current price + change */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {price != null && (
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtChartPrice(price)}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--fg-3)', marginLeft: 5 }}>{ccy}</span>
          </span>
        )}
        {change != null && (
          <span style={{ fontSize: 13, fontWeight: 600, color: isUp ? 'var(--green-600)' : 'var(--red-600)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {isUp ? '+' : ''}{fmtChartPrice(change)}
            {' '}({isUp ? '+' : ''}{changePct.toFixed(2)}%)
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--fg-3)', marginLeft: 6 }}>
              {opt.range === '1d' ? 'vs prev close' : `vs ${opt.label} ago`}
            </span>
          </span>
        )}
      </div>

      {/* Range selector + chart type toggle + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="range-btns">
          {RANGE_OPTS.map((r, i) => (
            <button key={r.range}
                    className={i === rangeIdx ? 'on' : ''}
                    onClick={() => { setRangeIdx(i); setError(null); }}>
              {r.label}
            </button>
          ))}
        </div>
        {candleBars.length > 1 && (
          <div className="pill-toggle" style={{ flexShrink: 0 }}>
            <button className={chartType === 'line'   ? 'on' : ''} onClick={() => setChartType('line')}>Line</button>
            <button className={chartType === 'candle' ? 'on' : ''} onClick={() => setChartType('candle')}>Candle</button>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {cachedAt && (
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
            Cached · {fmtAgo(cachedAt)}
          </span>
        )}
        <Button size="sm" icon="history" disabled={loading} onClick={() => load(true)}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* Chart area */}
      {loading && !chartData && (
        <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          Loading chart…
        </div>
      )}
      {error && (
        <div className="banner-soft">
          <Icon name="warning" size={15} />
          <span>Could not load chart data: {error}</span>
        </div>
      )}
      {!error && chartData && chartType === 'line' && (
        <PriceLineChart points={points} range={opt.range} />
      )}
      {!error && chartData && chartType === 'candle' && candleBars.length > 1 && (
        <CandleChart bars={candleBars} />
      )}
    </Modal>
  );
}

window.PriceChartModal    = PriceChartModal;
window.resolveChartSymbol = resolveChartSymbol;
window.CandleChart        = CandleChart;
