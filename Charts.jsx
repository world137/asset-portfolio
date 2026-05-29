/* eslint-disable */
/* Charts.jsx — SVG Donut / Pie with hover highlight + center label */

function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
// Annular (or wedge) arc path
function arcPath(cx, cy, rO, rI, start, end) {
  const large = end - start > 180 ? 1 : 0;
  const oS = polar(cx, cy, rO, start), oE = polar(cx, cy, rO, end);
  if (rI <= 0.5) {
    return `M ${cx} ${cy} L ${oS.x} ${oS.y} A ${rO} ${rO} 0 ${large} 1 ${oE.x} ${oE.y} Z`;
  }
  const iE = polar(cx, cy, rI, end), iS = polar(cx, cy, rI, start);
  return `M ${oS.x} ${oS.y} A ${rO} ${rO} 0 ${large} 1 ${oE.x} ${oE.y} L ${iE.x} ${iE.y} A ${rI} ${rI} 0 ${large} 0 ${iS.x} ${iS.y} Z`;
}

const Donut = ({ segments, size = 188, style = 'donut', hot = null, onHover, center }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2, cy = size / 2;
  const rO = size / 2 - 2;
  const rI = style === 'donut' ? rO * 0.62 : 0;
  let acc = 0;
  const arcs = segments.map((seg, i) => {
    const start = (acc / total) * 360;
    acc += seg.value;
    const end = (acc / total) * 360;
    const isFull = segments.length === 1 || end - start >= 359.999;
    return { seg, i, start, end, isFull };
  });
  return (
    <div className={`donut${hot != null ? ' dim' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map(({ seg, i, start, end, isFull }) => {
          const common = {
            fill: seg.color, stroke: 'var(--bg-surface)', strokeWidth: 1.5,
            className: hot === i ? 'hot' : '',
            onMouseEnter: () => onHover && onHover(i),
            onMouseLeave: () => onHover && onHover(null),
          };
          if (isFull) {
            // full ring or full circle
            return rI > 0.5
              ? <circle key={i} cx={cx} cy={cy} r={(rO + rI) / 2} fill="none" stroke={seg.color}
                        strokeWidth={rO - rI} className={hot === i ? 'hot' : ''}
                        onMouseEnter={() => onHover && onHover(i)} onMouseLeave={() => onHover && onHover(null)} />
              : <circle key={i} cx={cx} cy={cy} r={rO} {...common} />;
          }
          return <path key={i} d={arcPath(cx, cy, rO, rI, start, end)} {...common} />;
        })}
      </svg>
      {center && <div className="center">{center}</div>}
    </div>
  );
};

window.Donut = Donut;

/* ============================================================================
   PortfolioLineChart — historical portfolio value chart with range selector
   ============================================================================ */
const LINE_RANGES = ['5D', '1M', '6M', 'YTD', '1Y', '5Y', 'All'];

function filterSnapshotsByRange(data, range) {
  if (!data || !data.length) return [];
  const now = new Date();
  let cutDate;
  if (range === '5D')  cutDate = new Date(now - 5 * 86400000);
  else if (range === '1M')  cutDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  else if (range === '6M')  cutDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  else if (range === 'YTD') cutDate = new Date(now.getFullYear(), 0, 1);
  else if (range === '1Y')  cutDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  else if (range === '5Y')  cutDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  else return data;
  const cutStr = cutDate.toISOString().slice(0, 10);
  return data.filter(d => d.date >= cutStr);
}

const PortfolioLineChart = ({ snapshots, displayCcy, fxRate }) => {
  const [range, setRange] = React.useState('1M');
  const [hoverIdx, setHoverIdx] = React.useState(null);

  const W = 600, H = 180;
  const PAD = { t: 20, r: 16, b: 28, l: 74 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const rate = fxRate || 1;
  const sym = displayCcy === 'USD' ? '$' : '฿';

  const allData = (snapshots || [])
    .map(s => ({ date: s.date, value: displayCcy === 'USD' ? s.value / rate : s.value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const data = filterSnapshotsByRange(allData, range);
  const noData = data.length < 2;

  let pts = [], lineD = '', areaD = '', isUp = true;
  let yTicks = [];

  if (!noData) {
    const values = data.map(d => d.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = (maxV - minV) || maxV * 0.02 || 1;
    const padded = span * 0.1;
    const minY = minV - padded;
    const maxY = maxV + padded;
    const spanY = maxY - minY;

    pts = data.map((d, i) => ({
      x: PAD.l + (data.length > 1 ? (i / (data.length - 1)) : 0.5) * iW,
      y: PAD.t + (1 - (d.value - minY) / spanY) * iH,
      ...d,
    }));

    lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    areaD = lineD
      + ` L${pts[pts.length - 1].x.toFixed(1)} ${(PAD.t + iH).toFixed(1)}`
      + ` L${pts[0].x.toFixed(1)} ${(PAD.t + iH).toFixed(1)} Z`;

    isUp = data[data.length - 1].value >= data[0].value;

    yTicks = [0, 0.33, 0.67, 1].map(f => ({
      y: PAD.t + (1 - f) * iH,
      v: minY + f * spanY,
    }));
  }

  const first = data.length ? data[0].value : 0;
  const last  = data.length ? data[data.length - 1].value : 0;
  const chg = last - first;
  const chgPct = first ? (chg / first) * 100 : 0;
  const color = isUp ? 'var(--green-600)' : 'var(--red-600)';
  const gradId = isUp ? 'lcfill-up' : 'lcfill-dn';
  const hover = hoverIdx != null && pts[hoverIdx] ? pts[hoverIdx] : null;
  const displayVal = hover ? hover.value : last;

  const handleMouseMove = (e) => {
    if (!pts.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    let best = 0, bestDist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < bestDist) { bestDist = d; best = i; } });
    setHoverIdx(best);
  };

  return (
    <div className="linechart-wrap">
      <div className="linechart-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="linechart-val">{sym}{window.fmtBig(displayVal)}</span>
          {!noData && (
            <span className={'linechart-chg ' + (chg >= 0 ? 'up' : 'down')}>
              {chg >= 0 ? '+' : ''}{sym}{window.fmtBig(Math.abs(chg))}
              {' '}({chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%)
              {hover && <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 8 }}>{hover.date}</span>}
            </span>
          )}
        </div>
        <div className="range-btns">
          {LINE_RANGES.map(r => (
            <button key={r} className={r === range ? 'on' : ''} onClick={() => { setRange(r); setHoverIdx(null); }}>{r}</button>
          ))}
        </div>
      </div>

      {noData ? (
        <div className="linechart-empty">
          No history yet for this range — the portfolio value is snapshotted daily when prices are refreshed.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="linechart-svg"
             onMouseMove={handleMouseMove}
             onMouseLeave={() => setHoverIdx(null)}>
          <defs>
            <linearGradient id="lcfill-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green-600)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--green-600)" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="lcfill-dn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--red-600)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--red-600)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Y-axis grid + labels */}
          {yTicks.map((tk, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={tk.y.toFixed(1)} y2={tk.y.toFixed(1)}
                    stroke="var(--border-1)" strokeWidth="0.8" strokeDasharray="3 5" />
              <text x={PAD.l - 6} y={tk.y + 4} textAnchor="end" fontSize="9.5"
                    fill="var(--fg-4)" fontFamily="var(--font-mono)">
                {sym}{window.fmtBig(tk.v)}
              </text>
            </g>
          ))}

          {/* X-axis baseline */}
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + iH} y2={PAD.t + iH}
                stroke="var(--border-2)" strokeWidth="0.8" />

          {/* X date labels */}
          <text x={PAD.l} y={H - 6} textAnchor="start" fontSize="9.5"
                fill="var(--fg-4)" fontFamily="var(--font-mono)">{data[0].date}</text>
          <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="9.5"
                fill="var(--fg-4)" fontFamily="var(--font-mono)">{data[data.length - 1].date}</text>

          {/* Area fill + line */}
          <path d={areaD} fill={`url(#${gradId})`} />
          <path d={lineD} fill="none" stroke={color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />

          {/* Hover: crosshair + dot */}
          {hover && (
            <g>
              <line x1={hover.x.toFixed(1)} x2={hover.x.toFixed(1)} y1={PAD.t} y2={PAD.t + iH}
                    stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx={hover.x.toFixed(1)} cy={hover.y.toFixed(1)} r="4"
                      fill={color} stroke="var(--bg-surface)" strokeWidth="2.5" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
};

window.PortfolioLineChart = PortfolioLineChart;
