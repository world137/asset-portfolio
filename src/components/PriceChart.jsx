/* eslint-disable */
/* PriceChart.jsx — Historical price chart modal for individual assets */

const CHART_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const RANGE_OPTS = [
  { label: '1D', range: '1d' },
  { label: '1W', range: '5d' },
  { label: '1M', range: '1mo' },
  { label: '3M', range: '3mo' },
  { label: '6M', range: '6mo' },
  { label: '1Y', range: '1y' },
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

  // pick ~4 evenly spaced x-axis labels
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
      {/* Hover tooltip row */}
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

        {/* Y-axis gridlines + labels */}
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

        {/* X-axis baseline */}
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + iH} y2={PAD.t + iH}
              stroke="var(--border-2)" strokeWidth="0.8" />

        {/* X-axis date labels */}
        {xTicks.map((idx, i) => {
          const anchor = i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle';
          return (
            <text key={idx} x={xOf(idx).toFixed(1)} y={H - 4} textAnchor={anchor}
                  fontSize="9.5" fill="var(--fg-4)" fontFamily="var(--font-mono)">
              {fmtChartDate(points[idx].t, range)}
            </text>
          );
        })}

        {/* Gradient fill */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Price line */}
        <path d={lineD} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover crosshair + dot */}
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

function PriceChartModal({ classKey, name, onClose }) {
  const symbol = resolveChartSymbol(classKey, name);
  const [rangeIdx, setRangeIdx] = React.useState(2); // default 1M
  const [chartData, setChartData]   = React.useState(null);
  const [loading, setLoading]       = React.useState(false);
  const [error, setError]           = React.useState(null);
  const [cachedAt, setCachedAt]     = React.useState(null);

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
  const firstClose = points[0]?.c;
  const lastClose  = points[points.length - 1]?.c ?? price;
  const change     = lastClose != null && firstClose != null ? lastClose - firstClose : null;
  const changePct  = change != null && firstClose ? (change / firstClose) * 100 : null;
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
          </span>
        )}
      </div>

      {/* Range selector + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div className="range-btns">
          {RANGE_OPTS.map((r, i) => (
            <button key={r.range}
                    className={i === rangeIdx ? 'on' : ''}
                    onClick={() => { setRangeIdx(i); setError(null); }}>
              {r.label}
            </button>
          ))}
        </div>
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
      {!error && chartData && (
        <PriceLineChart points={points} range={opt.range} />
      )}
    </Modal>
  );
}

window.PriceChartModal   = PriceChartModal;
window.resolveChartSymbol = resolveChartSymbol;
