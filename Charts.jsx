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
