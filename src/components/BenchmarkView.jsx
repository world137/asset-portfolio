/* eslint-disable */
/* BenchmarkView.jsx — Feature #5: Portfolio vs Benchmark comparison */

const BENCHMARK_OPTIONS = [
  { key: 'set',   label: 'SET (Thailand)' },
  { key: 'sp500', label: 'S&P 500' },
  { key: 'ndx',   label: 'NASDAQ-100' },
  { key: 'dji',   label: 'Dow Jones' },
  { key: 'msci',  label: 'MSCI World ETF' },
];

const RANGE_OPTIONS = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y',  label: '1Y' },
  { key: '2y',  label: '2Y' },
  { key: '5y',  label: '5Y' },
];

const BENCH_COLORS = {
  set:   '#ef4444',
  sp500: '#3b82f6',
  ndx:   '#8b5cf6',
  dji:   '#f59e0b',
  msci:  '#06b6d4',
};

function BenchmarkView() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  const [range,      setRange]      = React.useState('1y');
  const [selected,   setSelected]   = React.useState(new Set(['set', 'sp500']));
  const [benchData,  setBenchData]  = React.useState({});
  const [loading,    setLoading]    = React.useState(false);
  const [error,      setError]      = React.useState(null);

  const snapshots = Store.getSnapshots();

  function toggleBench(key) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  React.useEffect(() => {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    const symbols = [...selected].join(',');
    fetch(`/api/benchmark?range=${range}&symbols=${symbols}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { setBenchData(j.benchmarks || {}); setLoading(false); })
      .catch(e => { setError('Failed to load benchmark data.'); setLoading(false); });
  }, [range, [...selected].sort().join(',')]);

  // Build portfolio series: normalize to 100 from the first date with data
  const portSorted = [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));

  function buildNormalized(points) {
    if (!points || points.length === 0) return [];
    const base = points[0].close || points[0].value;
    if (!base) return [];
    return points.map(p => ({ date: p.date, value: ((p.close || p.value) / base) * 100 }));
  }

  // Filter portfolio snapshots to match the range
  function filterPortByRange(snaps, rangeKey) {
    if (!snaps.length) return snaps;
    const now = new Date();
    const cutoffMap = { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825 };
    const days = cutoffMap[rangeKey];
    if (!days) return snaps;
    const cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    return snaps.filter(s => s.date >= cutoff);
  }

  const filteredPort = filterPortByRange(portSorted, range);
  const portNorm     = buildNormalized(filteredPort.map(s => ({ date: s.date, close: s.value })));

  // Merge all series for the chart
  const allSeries = [
    { key: 'portfolio', label: 'My Portfolio', color: '#22c55e', points: portNorm },
    ...[...selected].map(key => {
      const bm = benchData[key];
      if (!bm) return null;
      const norm = buildNormalized(bm.points);
      return { key, label: bm.label, color: BENCH_COLORS[key] || '#888', points: norm };
    }).filter(Boolean),
  ].filter(s => s.points && s.points.length > 0);

  // Canvas chart
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || allSeries.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const PAD = { top: 24, right: 16, bottom: 36, left: 52 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top  - PAD.bottom;

    // Collect all points
    const allDates  = [...new Set(allSeries.flatMap(s => s.points.map(p => p.date)))].sort();
    const allValues = allSeries.flatMap(s => s.points.map(p => p.value));
    const minV = Math.min(...allValues) * 0.99;
    const maxV = Math.max(...allValues) * 1.01;
    const rangeV = maxV - minV || 1;

    function xOf(date) { return PAD.left + (allDates.indexOf(date) / (allDates.length - 1)) * cw; }
    function yOf(v)    { return PAD.top  + ch * (1 - (v - minV) / rangeV); }

    // Background
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 1;
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = minV + (rangeV * i / ticks);
      const y = yOf(v);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cw, y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.65)';
      ctx.font = '10px var(--font-mono, monospace)';
      ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(1), PAD.left - 4, y + 3);
    }

    // Reference line at 100
    if (minV < 100 && maxV > 100) {
      ctx.save();
      ctx.strokeStyle = 'rgba(128,128,128,0.3)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      const y100 = yOf(100);
      ctx.beginPath(); ctx.moveTo(PAD.left, y100); ctx.lineTo(PAD.left + cw, y100); ctx.stroke();
      ctx.restore();
    }

    // Date labels
    const labelStep = Math.max(1, Math.floor(allDates.length / 6));
    ctx.fillStyle = 'rgba(128,128,128,0.65)';
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    allDates.filter((_, i) => i % labelStep === 0 || i === allDates.length - 1).forEach(d => {
      ctx.fillText(d.slice(2, 7), xOf(d), H - 4);
    });

    // Series lines
    for (const s of allSeries) {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.key === 'portfolio' ? 2.5 : 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = xOf(p.date), y = yOf(p.value);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Last point dot
      const last = s.points[s.points.length - 1];
      if (last) {
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(xOf(last.date), yOf(last.value), 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }, [allSeries, range]);

  // Performance table: total return per series
  function totalReturn(points) {
    if (!points || points.length < 2) return null;
    return points[points.length - 1].value - 100;
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Benchmark Comparison</h1>
          <div className="t-small">Portfolio performance vs market indices · normalized to 100 at start of period</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div className="layoutseg">
          {RANGE_OPTIONS.map(r => (
            <button key={r.key} className={range === r.key ? 'on' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BENCHMARK_OPTIONS.map(b => (
            <button key={b.key}
                    onClick={() => toggleBench(b.key)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '2px solid',
                      borderColor: selected.has(b.key) ? BENCH_COLORS[b.key] : 'var(--border-1)',
                      background: selected.has(b.key) ? BENCH_COLORS[b.key] + '22' : 'transparent',
                      color: selected.has(b.key) ? BENCH_COLORS[b.key] : 'var(--fg-3)',
                      fontWeight: selected.has(b.key) ? 700 : 400,
                    }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', height: 320, padding: '8px' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(var(--bg-card-rgb,255,255,255),0.8)', zIndex: 2, fontSize: 13, color: 'var(--fg-3)' }}>
              Loading benchmark data…
            </div>
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, color: 'var(--red-600)' }}>
              {error}
            </div>
          )}
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '8px 12px 12px', borderTop: '1px solid var(--border-1)' }}>
          {allSeries.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: s.key === 'portfolio' ? 14 : 10, height: 3, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontWeight: s.key === 'portfolio' ? 700 : 400, color: s.key === 'portfolio' ? 'var(--fg-1)' : 'var(--fg-2)' }}>
                {s.label}
              </span>
              {totalReturn(s.points) !== null && (
                <span style={{ color: totalReturn(s.points) >= 0 ? 'var(--green-600)' : 'var(--red-600)', fontWeight: 700, fontSize: 11 }}>
                  {totalReturn(s.points) >= 0 ? '+' : ''}{totalReturn(s.points).toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performance table */}
      <div className="card">
        <div className="card-h"><div className="t">Performance Comparison</div><div className="s">Total return over selected period</div></div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="ptable">
            <thead>
              <tr>
                <th>Index / Portfolio</th>
                <th className="num">Start Value</th>
                <th className="num">End Value</th>
                <th className="num">Total Return</th>
                <th className="num">vs Portfolio</th>
              </tr>
            </thead>
            <tbody>
              {allSeries.map(s => {
                const ret = totalReturn(s.points);
                const portRet = totalReturn(portNorm);
                const alpha = (ret !== null && portRet !== null && s.key !== 'portfolio') ? ret - portRet : null;
                return (
                  <tr key={s.key} className="pos">
                    <td>
                      <span className="tk">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontWeight: s.key === 'portfolio' ? 700 : 400 }}>{s.label}</span>
                      </span>
                    </td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>100.0</td>
                    <td className="num" style={{ fontWeight: 600 }}>{ret !== null ? (100 + ret).toFixed(1) : '—'}</td>
                    <td className={'num ' + (ret === null ? '' : ret >= 0 ? 'up' : 'down')} style={{ fontWeight: 700 }}>
                      {ret === null ? '—' : (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%'}
                    </td>
                    <td className={'num ' + (alpha === null ? '' : alpha >= 0 ? 'up' : 'down')} style={{ fontSize: 12 }}>
                      {alpha === null ? '—' : (alpha >= 0 ? '+' : '') + alpha.toFixed(2) + '%'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
