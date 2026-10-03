/* ChartDrawings.jsx — TradingView-style drawing tools for CandleChart.
   Drawings are stored in data coordinates ({ t: ms, v: price }) so they stay
   anchored when the visible range changes, and persist per symbol in localStorage. */

const CD_COLORS = ['#2979ff', '#ff9800', '#e91e63', '#9c27b0', '#26a69a', '#ef5350', '#8d8d93'];
const CD_FIB = [
  { r: 0,     c: '#8d8d93' }, { r: 0.236, c: '#ef5350' }, { r: 0.382, c: '#ff9800' },
  { r: 0.5,   c: '#26a69a' }, { r: 0.618, c: '#2979ff' }, { r: 0.786, c: '#9c27b0' },
  { r: 1,     c: '#8d8d93' },
];
const CD_TOOLS = [
  { id: 'cursor', label: 'Cursor / select',          pts: 0 },
  { id: 'trend',  label: 'Trend line',               pts: 2 },
  { id: 'ray',    label: 'Ray',                      pts: 2 },
  { id: 'hline',  label: 'Horizontal line',          pts: 1 },
  { id: 'vline',  label: 'Vertical line',            pts: 1 },
  { id: 'rect',   label: 'Rectangle',                pts: 2 },
  { id: 'fib',    label: 'Fib retracement',          pts: 2 },
];

function cdLoad(key) {
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem('chartDrawings:' + key)) || []; } catch { return []; }
}
function cdSave(key, list) {
  if (!key) return;
  try { localStorage.setItem('chartDrawings:' + key, JSON.stringify(list)); } catch {}
}

// ── Coordinate mapping (g = geometry of the current CandleChart render) ───────

function cdAvgDt(g) {
  return g.n > 1 ? (g.times[g.n - 1] - g.times[0]) / (g.n - 1) : 864e5;
}

// time (ms) -> fractional bar index (extrapolates beyond the visible bars)
function cdFrac(g, t) {
  const { times, n } = g;
  if (t <= times[0]) return (t - times[0]) / cdAvgDt(g);
  if (t >= times[n - 1]) return n - 1 + (t - times[n - 1]) / cdAvgDt(g);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; }
  return lo + (t - times[lo]) / (times[hi] - times[lo]);
}

function cdTimeAt(g, f) {
  const { times, n } = g;
  if (f <= 0) return times[0] + f * cdAvgDt(g);
  if (f >= n - 1) return times[n - 1] + (f - (n - 1)) * cdAvgDt(g);
  const i = Math.floor(f);
  return times[i] + (f - i) * (times[i + 1] - times[i]);
}

function cdToPx(g, p) {
  return {
    x: g.PAD.l + cdFrac(g, p.t) * g.step + g.step / 2,
    y: g.PAD.t + (1 - (p.v - g.yLo) / g.yRange) * g.iH,
  };
}

function cdFromPx(g, x, y, magnet, clamp) {
  if (clamp) {
    x = Math.max(g.PAD.l, Math.min(g.W - g.PAD.r, x));
    y = Math.max(g.PAD.t, Math.min(g.PAD.t + g.iH, y));
  }
  let f = (x - g.PAD.l - g.step / 2) / g.step;
  let v = g.yLo + (1 - (y - g.PAD.t) / g.iH) * g.yRange;
  if (magnet) {
    const i = Math.max(0, Math.min(g.n - 1, Math.round(f)));
    f = i;
    const b = g.display[i];
    let best = null, bestD = 14; // snap radius in svg px
    for (const price of [b.o, b.h, b.l, b.c]) {
      if (price == null) continue;
      const d = Math.abs(g.PAD.t + (1 - (price - g.yLo) / g.yRange) * g.iH - y);
      if (d < bestD) { bestD = d; best = price; }
    }
    if (best != null) v = best;
  }
  return { t: cdTimeAt(g, f), v };
}

// ── Hook: state + interaction ─────────────────────────────────────────────────

function useChartDrawings(storageKey) {
  const keyRef      = React.useRef(storageKey);
  const [drawings, setDrawings] = React.useState(() => cdLoad(storageKey));
  const drawingsRef = React.useRef(drawings);
  const [tool,   setTool]   = React.useState('cursor');
  const [color,  setColor]  = React.useState(CD_COLORS[0]);
  const [magnet, setMagnet] = React.useState(true);
  const [selId,  setSelId]  = React.useState(null);
  const [draft,  setDraft]  = React.useState(null);   // [firstPoint] while placing a 2-point drawing
  const [cur,    setCur]    = React.useState(null);   // live cursor point for the draft preview
  const hist = React.useRef([]);
  const drag = React.useRef(null);
  const suppressClick = React.useRef(false);
  const clipId = React.useRef('cdclip' + Math.random().toString(36).slice(2, 8)).current;

  React.useEffect(() => {
    keyRef.current = storageKey;
    const list = cdLoad(storageKey);
    drawingsRef.current = list;
    setDrawings(list); setSelId(null); setDraft(null); hist.current = [];
  }, [storageKey]);

  function commit(next, record) {
    if (record) hist.current = [...hist.current.slice(-49), drawingsRef.current];
    drawingsRef.current = next;
    setDrawings(next);
    cdSave(keyRef.current, next);
  }

  function pickTool(id) {
    setTool(id); setDraft(null);
    if (id !== 'cursor') setSelId(null);
  }

  function pickColor(c) {
    setColor(c);
    if (selId) commit(drawingsRef.current.map(d => d.id === selId ? { ...d, color: c } : d), true);
  }

  function remove() {
    if (!selId) return;
    commit(drawingsRef.current.filter(d => d.id !== selId), true);
    setSelId(null);
  }

  function clear() {
    if (!drawingsRef.current.length) return;
    commit([], true); setSelId(null); setDraft(null);
  }

  function undo() {
    const prev = hist.current.pop();
    if (!prev) return;
    drawingsRef.current = prev;
    setDrawings(prev); cdSave(keyRef.current, prev);
    setSelId(null);
  }

  function add(type, pts) {
    const d = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, pts, color };
    commit([...drawingsRef.current, d], true);
    setSelId(d.id); setTool('cursor'); setDraft(null);
  }

  function handleClick(px, g) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (tool === 'cursor') { setSelId(null); return; }
    const p = cdFromPx(g, px.x, px.y, magnet, true);
    const def = CD_TOOLS.find(t => t.id === tool);
    if (def.pts === 1) add(tool, [p]);
    else if (!draft)   { setDraft([p]); setCur(p); }
    else               add(tool, [draft[0], p]);
  }

  function handleMove(px, g) {
    const dg = drag.current;
    if (dg) {
      dg.moved = true;
      const list = drawingsRef.current;
      if (dg.handle >= 0) {
        const p = cdFromPx(g, px.x, px.y, magnet, true);
        commit(list.map(d => d.id === dg.id ? { ...d, pts: d.pts.map((q, i) => i === dg.handle ? p : q) } : d), false);
      } else {
        const dx = px.x - dg.start.x, dy = px.y - dg.start.y;
        const pts = dg.origPx.map(q => cdFromPx(g, q.x + dx, q.y + dy, false, false));
        commit(list.map(d => d.id === dg.id ? { ...d, pts } : d), false);
      }
    } else if (draft) {
      setCur(cdFromPx(g, px.x, px.y, magnet, true));
    }
  }

  // handle = -1 drags the whole drawing, >= 0 drags that single anchor point
  function startDrag(id, handle, px, g) {
    const d = drawingsRef.current.find(x => x.id === id);
    if (!d) return;
    setSelId(id);
    hist.current = [...hist.current.slice(-49), drawingsRef.current];
    drag.current = { id, handle, start: px, origPx: d.pts.map(p => cdToPx(g, p)), moved: false };
  }

  function endDrag() {
    if (drag.current) suppressClick.current = drag.current.moved;
    drag.current = null;
  }

  React.useEffect(() => {
    function onKey(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { setDraft(null); setTool('cursor'); setSelId(null); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { e.preventDefault(); remove(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return {
    drawings, tool, color, magnet, selId, draft, cur, clipId,
    pickTool, pickColor, remove, clear, undo, handleClick, handleMove, startDrag, endDrag,
    toggleMagnet: () => setMagnet(m => !m),
    canUndo: hist.current.length > 0,
  };
}

// ── Shape geometry (pixel space) ──────────────────────────────────────────────

function cdShape(d, g) {
  const px  = d.pts.map(p => cdToPx(g, p));
  const x0 = g.PAD.l, x1 = g.W - g.PAD.r, y0 = g.PAD.t, y1 = g.PAD.t + g.iH;
  const col = d.color;
  const out = { segs: [], fills: [], labels: [], rect: null };
  const a = px[0], b = px[1];

  if (d.type === 'trend' && b) {
    out.segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: col });
  } else if (d.type === 'ray' && b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    out.segs.push({ x1: a.x, y1: a.y, x2: a.x + dx / len * 5000, y2: a.y + dy / len * 5000, color: col });
  } else if (d.type === 'hline') {
    out.segs.push({ x1: x0, y1: a.y, x2: x1, y2: a.y, color: col });
    out.labels.push({ x: x1 - 3, y: a.y - 3, text: fmtChartPrice(d.pts[0].v), color: col, anchor: 'end' });
  } else if (d.type === 'vline') {
    out.segs.push({ x1: a.x, y1: y0, x2: a.x, y2: y1, color: col });
  } else if (d.type === 'rect' && b) {
    out.rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), color: col };
  } else if (d.type === 'fib' && b) {
    const xa = Math.min(a.x, b.x), xb = Math.max(a.x, b.x);
    const [p1, p2] = d.pts;
    const ys = CD_FIB.map(l => {
      const price = p2.v + (p1.v - p2.v) * l.r;
      return { ...l, price, y: g.PAD.t + (1 - (price - g.yLo) / g.yRange) * g.iH };
    });
    ys.forEach((l, i) => {
      out.segs.push({ x1: xa, y1: l.y, x2: xb, y2: l.y, color: l.c });
      out.labels.push({ x: xa + 3, y: l.y - 3, text: `${l.r} (${fmtChartPrice(l.price)})`, color: l.c, anchor: 'start' });
      if (i > 0) out.fills.push({ x: xa, y: Math.min(l.y, ys[i - 1].y), w: xb - xa, h: Math.abs(l.y - ys[i - 1].y), color: l.c });
    });
    out.segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: '#8d8d93', dash: '4 4' });
  }
  return { ...out, px };
}

// ── SVG layer, rendered inside the main chart <svg> ───────────────────────────

function ChartDrawingsLayer({ dr, g }) {
  const interactive = dr.tool === 'cursor';
  const items = dr.drawings.map(d => ({ d, sel: d.id === dr.selId, preview: false }));
  if (dr.draft && dr.cur) {
    items.push({ d: { id: '__draft', type: dr.tool, pts: [dr.draft[0], dr.cur], color: dr.color }, sel: false, preview: true });
  }

  return (
    <g clipPath={`url(#${dr.clipId})`}>
      <clipPath id={dr.clipId}>
        <rect x={g.PAD.l} y={g.PAD.t} width={g.iW} height={g.iH} />
      </clipPath>
      {items.map(({ d, sel, preview }) => {
        const s = cdShape(d, g);
        const down = (e, handle) => {
          e.stopPropagation();
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          dr.startDrag(d.id, handle, { x: (e.clientX - r.left) * (g.W / r.width), y: (e.clientY - r.top) * (g.H / r.height) }, g);
        };
        const hit = {
          style: { pointerEvents: interactive && !preview ? 'stroke' : 'none', cursor: 'move' },
          onMouseDown: e => down(e, -1), onClick: e => e.stopPropagation(),
        };
        return (
          <g key={d.id} opacity={preview ? 0.6 : 1}>
            {s.rect && (
              <rect x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h}
                    fill={s.rect.color} fillOpacity="0.12" stroke={s.rect.color} strokeWidth={sel ? 2 : 1.2}
                    style={{ pointerEvents: interactive && !preview ? 'all' : 'none', cursor: 'move' }}
                    onMouseDown={e => down(e, -1)} onClick={e => e.stopPropagation()} />
            )}
            {s.fills.map((f, i) => (
              <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.color} fillOpacity="0.07" style={{ pointerEvents: 'none' }} />
            ))}
            {s.segs.map((l, i) => (
              <g key={i}>
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color}
                      strokeWidth={sel ? 2 : 1.3} strokeDasharray={l.dash} style={{ pointerEvents: 'none' }} />
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="transparent" strokeWidth="10" {...hit} />
              </g>
            ))}
            {s.labels.map((l, i) => (
              <text key={i} x={l.x} y={l.y} textAnchor={l.anchor} fontSize="9" fontFamily="var(--font-mono)"
                    fill={l.color} style={{ pointerEvents: 'none' }}>{l.text}</text>
            ))}
            {sel && s.px.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="var(--bg-surface)" stroke={d.color} strokeWidth="2"
                      style={{ cursor: 'grab', pointerEvents: 'all' }}
                      onMouseDown={e => down(e, i)} onClick={e => e.stopPropagation()} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

const CD_ICONS = {
  cursor: <path d="M6 3l12 8-5.5 1.5L10 18z" />,
  trend:  <><line x1="5" y1="18" x2="19" y2="6" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /></>,
  ray:    <><line x1="5" y1="18" x2="21" y2="4" /><circle cx="5" cy="18" r="2" /></>,
  hline:  <><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="2" /></>,
  vline:  <><line x1="12" y1="3" x2="12" y2="21" /><circle cx="12" cy="12" r="2" /></>,
  rect:   <rect x="5" y="7" width="14" height="10" />,
  fib:    <><line x1="4" y1="5" x2="20" y2="5" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><line x1="4" y1="19" x2="20" y2="19" /></>,
};

function ChartDrawToolbar({ dr, symbol }) {
  const btn = (on, disabled) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 26, minWidth: 26, padding: '0 7px',
    fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
    background: on ? 'var(--bg-selected)' : 'var(--bg-surface)',
    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-2)'),
    color: on ? 'var(--accent)' : 'var(--fg-3)',
  });
  const sep = <div style={{ width: 1, height: 18, background: 'var(--border-2)', margin: '0 2px' }} />;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', margin: '4px 0' }}>
      {CD_TOOLS.map(t => (
        <button key={t.id} title={t.label} style={btn(dr.tool === t.id)} onClick={() => dr.pickTool(t.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">{CD_ICONS[t.id]}</svg>
        </button>
      ))}
      {sep}
      {CD_COLORS.map(c => (
        <button key={c} title="Drawing color" onClick={() => dr.pickColor(c)}
                style={{ width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
                         border: dr.color === c ? '2px solid var(--fg-1)' : '2px solid transparent' }} />
      ))}
      {sep}
      <button title="Snap to open/high/low/close" style={btn(dr.magnet)} onClick={dr.toggleMagnet}>Magnet</button>
      <button title="Undo (Ctrl/⌘+Z)" style={btn(false, !dr.canUndo)} disabled={!dr.canUndo} onClick={dr.undo}>↶</button>
      <button title="Delete selected (Del)" style={btn(false, !dr.selId)} disabled={!dr.selId} onClick={dr.remove}>Delete</button>
      <button title="Remove all drawings" style={btn(false, !dr.drawings.length)} disabled={!dr.drawings.length} onClick={dr.clear}>Clear</button>
      {symbol && <span title="Drawings are saved in this browser, per symbol"
                       style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-4)' }}>● saved for {symbol}</span>}
      {dr.draft && <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 4 }}>Click to place the second point · Esc to cancel</span>}
    </div>
  );
}

window.useChartDrawings    = useChartDrawings;
window.ChartDrawingsLayer  = ChartDrawingsLayer;
window.ChartDrawToolbar    = ChartDrawToolbar;
