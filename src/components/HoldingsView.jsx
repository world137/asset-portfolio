/* eslint-disable */
/* HoldingsView.jsx — manage one asset class: positions, lots, inline edits */

function PositionTagCell({ classKey, positionName }) {
  const [editing,    setEditing]    = React.useState(false);
  const [addingTag,  setAddingTag]  = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor,setNewTagColor]= React.useState('#3b82f6');

  const key        = classKey + ':' + positionName;
  const allTags    = Store.getTags();
  const selectedIds= Store.getHoldingTags(key);

  const toggle = (tagId) => {
    const next = selectedIds.includes(tagId)
      ? selectedIds.filter(id => id !== tagId)
      : [...selectedIds, tagId];
    Store.setHoldingTags(key, next);
  };

  const createTag = () => {
    if (!newTagName.trim()) { setAddingTag(false); return; }
    const id = Store.addTag(newTagName.trim(), newTagColor);
    Store.setHoldingTags(key, [...selectedIds, id]);
    setNewTagName(''); setAddingTag(false);
  };

  if (!editing) {
    return (
      <span onClick={e => { e.stopPropagation(); setEditing(true); }}
            title="Click to edit tags"
            style={{ cursor: 'pointer', display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {selectedIds.length === 0
          ? <span style={{ color: 'var(--fg-4)', fontSize: 11, borderBottom: '1px dashed var(--border-2)' }}>—</span>
          : selectedIds.map(tid => {
              const tag = allTags.find(t => t.id === tid);
              if (!tag) return null;
              return (
                <span key={tid} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: tag.color + '22', color: tag.color,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: tag.color, display: 'inline-block', flexShrink: 0 }} />
                  {tag.name}
                </span>
              );
            })
        }
      </span>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ minWidth: 160 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {allTags.map(tag => {
          const sel = selectedIds.includes(tag.id);
          return (
            <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                border: sel ? '2px solid ' + tag.color : '1.5px solid var(--border-2)',
                background: sel ? tag.color + '28' : 'transparent',
                color: sel ? tag.color : 'var(--fg-2)',
              }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tag.color, display: 'inline-block', flexShrink: 0 }} />
              {tag.name}
            </button>
          );
        })}
        {allTags.length === 0 && !addingTag && (
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>No tags yet</span>
        )}
      </div>
      {!addingTag ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setAddingTag(true)}
            style={{ fontSize: 11, color: 'var(--accent,#2962ab)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            + New tag
          </button>
          <button type="button" onClick={() => { setEditing(false); setAddingTag(false); setNewTagName(''); }}
            style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            Done
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
          <input className="input" style={{ width: 100, fontSize: 12, padding: '3px 7px' }}
                 placeholder="Tag name" autoFocus value={newTagName}
                 onChange={e => setNewTagName(e.target.value)}
                 onKeyDown={e => {
                   if (e.key === 'Enter') createTag();
                   if (e.key === 'Escape') { setAddingTag(false); setNewTagName(''); }
                 }} />
          <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)}
                 style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border-2)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }} />
          <button type="button" onClick={createTag}
            style={{ fontSize: 11, cursor: 'pointer', background: 'var(--accent,#2962ab)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px' }}>
            Create
          </button>
          <button type="button" onClick={() => { setAddingTag(false); setNewTagName(''); }}
            style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function PrePostBadge({ classKey, name, ccy }) {
  const data = Store.prePostPrice(classKey, name);
  if (!data) return null;
  const isPos = data.pct >= 0;
  const pctStr = data.pct != null
    ? (isPos ? '+' : '') + data.pct.toFixed(2) + '%'
    : null;
  return (
    <div style={{ fontSize: 11, marginTop: 2, color: isPos ? 'var(--up,#1a9e5c)' : 'var(--down,#d63b3b)', whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--fg-4)', marginRight: 3 }}>{data.type === 'pre' ? 'Pre' : 'Post'}</span>
      {window.fmtPrice(data.price, ccy)}
      {pctStr && <span style={{ marginLeft: 3 }}>({pctStr})</span>}
    </div>
  );
}

function PriceEdit({ position, classKey, ccy }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState('');

  if (editing) {
    const commit = () => {
      if (v !== '' && !isNaN(+v)) Store.setCurrentPrice(classKey, position.name, +v);
      setEditing(false);
    };
    return (
      <input className="editprice" autoFocus type="number" step="any" defaultValue={position.cur}
             onChange={e => setV(e.target.value)}
             onBlur={commit}
             onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  return (
    <span onClick={e => { e.stopPropagation(); setV(''); setEditing(true); }}
          title="Click to update current price"
          style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-2)' }}>
      {window.fmtPrice(position.cur, ccy)}
    </span>
  );
}

function SectorChip({ position, classKey }) {
  const [editing, setEditing] = React.useState(false);

  if (editing) {
    const commit = (val) => { Store.setSector(classKey, position.name, val.trim() || '—'); setEditing(false); };
    return (
      <input className="editprice" style={{ width: 120, textAlign: 'left', fontFamily: 'var(--font-sans)' }}
             autoFocus defaultValue={position.sector === '—' ? '' : position.sector} list="sectorlist"
             onBlur={e => commit(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  return <span className="sectorchip" onClick={e => { e.stopPropagation(); setEditing(true); }}>{position.sector}</span>;
}

function LotRows({ position, classKey, ccy, onEdit }) {
  return (
    <tr className="lotrow">
      <td colSpan={11}>
        <div className="lotinner">
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="lottable">
              <thead>
                <tr>
                  <th className="lbl">Buy lot</th>
                  <th className="num">Buy price</th>
                  <th className="num">Qty</th>
                  <th className="num">Cost</th>
                  <th className="num">Value</th>
                  <th className="num">P/L</th>
                  <th className="num">%</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {position.lots.map((lot, i) => (
                  <tr key={lot.id}>
                    <td className="lbl">Lot {i + 1}</td>
                    <td className="num">{window.fmtPrice(lot.price, ccy)}</td>
                    <td className="num">{window.fmtQty(lot.qty)}</td>
                    <td className="num">{window.fmtMoney(lot.cost, ccy, 2)}</td>
                    <td className="num">{window.fmtMoney(lot.value, ccy, 2)}</td>
                    <td className={'num ' + (lot.profit >= 0 ? 'up' : 'down')}>{(lot.profit >= 0 ? '+' : '−') + window.fmtMoney(Math.abs(lot.profit), ccy, 2)}</td>
                    <td className={'num ' + (lot.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(lot.pct)}</td>
                    <td>
                      <span className="lotact">
                        <button title="Edit" onClick={() => onEdit(lot)}><Icon name="edit" size={13} /></button>
                        <button className="del" title="Delete" onClick={() => { if (confirm('Delete this lot?')) Store.deleteLot(classKey, lot.id); }}><Icon name="trash" size={13} /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

function ClassAnalysis({ classKey }) {
  const settings  = Store.settings();
  const positions = Store.positions(classKey);
  const cls       = Store.classByKey(classKey);
  const isOther   = classKey === 'other';
  const sym       = window.ccySymbol(settings.displayCcy);
  const [hot, setHot] = React.useState(null);

  const map = new Map();
  for (const p of positions) {
    const key = isOther ? (p.type || '—') : (p.sector || '—');
    map.set(key, (map.get(key) || 0) + Store.toDisplay(p.value, cls.ccy));
  }
  const segs = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: window.SECTOR_PALETTE[i % window.SECTOR_PALETTE.length] }));
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;

  if (segs.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-h">
        <div>
          <div className="t">{isOther ? 'By Type' : 'By Sector'}</div>
          <div className="s">{segs.length} {isOther ? 'types' : 'sectors'} · valued in {settings.displayCcy}</div>
        </div>
      </div>
      <div className="card-b">
        <div className="chartwrap">
          <Donut segments={segs} size={160} style={settings.chartStyle} hot={hot} onHover={setHot}
                 center={
                   <React.Fragment>
                     <div className="c-lab">{isOther ? 'Types' : 'Sectors'}</div>
                     <div className="c-val" style={{ fontSize: 18 }}>{segs.length}</div>
                   </React.Fragment>
                 } />
          <div className="legend">
            {segs.map((s, i) => (
              <div className="row" key={s.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                <span className="sw" style={{ background: s.color }} />
                <span className="nm">{s.label}</span>
                <span className="vv">{sym}{window.fmtBig(s.value)}</span>
                <span className="pc">{((s.value / total) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Squarified Treemap Layout ──────────────────────────────────────────────────

function _tmAspect(row, rowArea, layoutLen) {
  let worst = 0;
  for (const item of row) {
    const iLong  = rowArea > 0 ? (item.norm / rowArea) * layoutLen : 0;
    const iCross = layoutLen > 0 ? rowArea / layoutLen : 0;
    if (iLong > 0 && iCross > 0) worst = Math.max(worst, Math.max(iLong / iCross, iCross / iLong));
  }
  return worst;
}

function _tmPlaceRow(row, rowArea, x, y, w, h, isWide, out) {
  if (isWide) {
    const stripH = w > 0 ? rowArea / w : 0;
    let cx = x;
    for (const item of row) {
      const iw = rowArea > 0 ? (item.norm / rowArea) * w : 0;
      out.push({ data: item.data, x: cx, y, w: iw, h: stripH });
      cx += iw;
    }
  } else {
    const stripW = h > 0 ? rowArea / h : 0;
    let cy = y;
    for (const item of row) {
      const ih = rowArea > 0 ? (item.norm / rowArea) * h : 0;
      out.push({ data: item.data, x, y: cy, w: stripW, h: ih });
      cy += ih;
    }
  }
}

function _tmSquarify(items, x, y, w, h, out) {
  if (!items.length || w <= 0 || h <= 0) return;
  if (items.length === 1) { out.push({ data: items[0].data, x, y, w, h }); return; }

  const isWide = w >= h;
  const layoutLen = isWide ? w : h;
  let row = [], rowArea = 0, prevWorst = Infinity;

  for (let i = 0; i < items.length; i++) {
    const testRow  = [...row, items[i]];
    const testArea = rowArea + items[i].norm;
    const testWorst = _tmAspect(testRow, testArea, layoutLen);

    if (row.length > 0 && testWorst > prevWorst) {
      _tmPlaceRow(row, rowArea, x, y, w, h, isWide, out);
      if (isWide) {
        const stripH = rowArea / w;
        _tmSquarify(items.slice(i), x, y + stripH, w, Math.max(0, h - stripH), out);
      } else {
        const stripW = rowArea / h;
        _tmSquarify(items.slice(i), x + stripW, y, Math.max(0, w - stripW), h, out);
      }
      return;
    }
    row.push(items[i]);
    rowArea = testArea;
    prevWorst = testWorst;
  }
  _tmPlaceRow(row, rowArea, x, y, w, h, isWide, out);
}

function squarifiedTreemap(dataItems, totalW, totalH) {
  if (!dataItems.length || totalW <= 0 || totalH <= 0) return [];
  const total = dataItems.reduce((s, i) => s + i.value, 0);
  if (!total) return [];
  const area   = totalW * totalH;
  const normed = [...dataItems]
    .sort((a, b) => b.value - a.value)
    .map(d => ({ data: d, norm: (d.value / total) * area }));
  const out = [];
  _tmSquarify(normed, 0, 0, totalW, totalH, out);
  return out;
}

// ── Bento Box View ─────────────────────────────────────────────────────────────

function getDayChangeBg(pct, totalPct) {
  const v = pct != null ? pct : totalPct;
  if (v == null) return { bg: 'var(--bg-sunken)', text: 'var(--fg-2)', border: 'transparent' };
  if (v >= 3)  return { bg: '#0d5c1a', text: '#fff',        border: 'transparent' };
  if (v >= 2)  return { bg: '#1a7a3a', text: '#fff',        border: 'transparent' };
  if (v >= 1)  return { bg: 'rgba(48,209,88,0.55)', text: '#fff',        border: 'transparent' };
  if (v >= 0)  return { bg: 'rgba(48,209,88,0.18)', text: 'var(--fg-1)', border: 'transparent' };
  if (v >= -1) return { bg: 'rgba(255,69,58,0.18)', text: 'var(--fg-1)', border: 'transparent' };
  if (v >= -2) return { bg: 'rgba(255,69,58,0.55)', text: '#fff',        border: 'transparent' };
  if (v >= -3) return { bg: '#7a1a1a', text: '#fff',        border: 'transparent' };
  return             { bg: '#4a0a0a', text: '#ffb3b3',      border: 'transparent' };
}

function BentoTooltip({ data, sym, x, y, containerW }) {
  const W = 200;
  const left = x + W + 16 > containerW ? x - W - 8 : x + 12;
  const dayPct   = data.dayPct;
  const totalPct = data.totalPct;
  const pctLabel = dayPct != null ? 'Day' : 'Total P/L';
  const pct      = dayPct != null ? dayPct : totalPct;
  const pctStr   = pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' : '—';
  const pctColor = pct == null ? 'var(--fg-2)' : pct >= 0 ? 'var(--green-600)' : 'var(--red-600)';

  return (
    <div style={{
      position: 'absolute', left, top: Math.max(4, y - 8),
      width: W, zIndex: 100, pointerEvents: 'none',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-2)',
      borderRadius: 8, padding: '10px 12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
      fontSize: 12, lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--fg-1)' }}>
        {data.name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--fg-2)' }}>Value</span>
        <span style={{ color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
          {sym}{window.fmtBig(data.value)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--fg-2)' }}>Allocation</span>
        <span style={{ color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
          {data.allocPct != null ? data.allocPct.toFixed(1) + '%' : '—'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--fg-2)' }}>{pctLabel}</span>
        <span style={{ color: pctColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {pctStr}
        </span>
      </div>
      {data.profit != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-2)' }}>P/L</span>
          <span style={{ color: data.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)', fontVariantNumeric: 'tabular-nums' }}>
            {data.profit >= 0 ? '+' : ''}{sym}{window.fmtBig(Math.abs(data.profit))}
          </span>
        </div>
      )}
    </div>
  );
}

function BentoView({ classKey }) {
  const positions    = Store.positions(classKey);
  const cls          = Store.classByKey(classKey);
  const settings     = Store.settings();
  const sym          = window.ccySymbol(settings.displayCcy);
  const containerRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(0);
  const [hovered, setHovered]       = React.useState(null); // { data, x, y }

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerW(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!positions.length) return (
    <div className="empty" style={{ padding: '40px 20px' }}>No holdings yet.</div>
  );

  const totalValue = positions.reduce((s, p) => s + Store.toDisplay(p.value, cls.ccy), 0);

  const items = positions
    .map(p => {
      const val = Store.toDisplay(p.value, cls.ccy);
      return {
        name:      p.name.replace(/THB$/, ''),
        rawName:   p.name,
        value:     val,
        cost:      Store.toDisplay(p.cost, cls.ccy),
        profit:    Store.toDisplay(p.profit, cls.ccy),
        dayPct:    Store.dayChangePct(classKey, p.name),
        totalPct:  p.pct,
        allocPct:  totalValue > 0 ? (val / totalValue) * 100 : 0,
      };
    })
    .filter(i => i.value > 0);

  const BENTO_H = Math.max(260, Math.min(500, window.innerHeight * 0.5));
  const GAP     = 3;
  const rects   = containerW > 10 ? squarifiedTreemap(items, containerW, BENTO_H) : [];

  return (
    // Outer wrapper: position:relative so tooltip is positioned correctly, but NOT overflow:hidden
    // so the tooltip can extend below/above the bento area without being clipped.
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}
         onMouseLeave={() => setHovered(null)}
         onTouchEnd={() => setHovered(null)}
         onTouchCancel={() => setHovered(null)}
         onTouchMove={e => {
           const touch = e.touches[0];
           const el = document.elementFromPoint(touch.clientX, touch.clientY);
           let cur = el;
           while (cur && cur !== containerRef.current) {
             const rn = cur.getAttribute('data-rawname');
             if (rn) {
               const found = items.find(i => i.rawName === rn);
               if (found) {
                 const rect = containerRef.current.getBoundingClientRect();
                 setHovered({ data: found, x: touch.clientX - rect.left, y: touch.clientY - rect.top });
               }
               return;
             }
             cur = cur.parentElement;
           }
         }}>
      {/* Inner box area: fixed height, overflow:hidden to contain the boxes */}
      <div style={{ position: 'relative', width: '100%', height: BENTO_H, overflow: 'hidden' }}>
      {rects.map(({ data, x, y, w, h }) => {
        const ax = x + GAP / 2, ay = y + GAP / 2;
        const aw = Math.max(0, w - GAP), ah = Math.max(0, h - GAP);
        const colors  = getDayChangeBg(data.dayPct, data.totalPct);
        const pct     = data.dayPct != null ? data.dayPct : data.totalPct;
        const pctStr  = pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' : null;

        // Only show text when box is large enough to be readable
        const minDim   = Math.min(aw, ah);
        const nameFz   = Math.min(24, Math.max(9,  minDim * 0.28));
        const pctFz    = Math.min(15, Math.max(8,  nameFz * 0.65));
        const showName = aw > 64  && ah > 40;
        const showPct  = aw > 80  && ah > 64 && pctStr != null;
        const pad      = Math.min(10, aw * 0.07);

        const isHov = hovered?.data.rawName === data.rawName;

        return (
          <div key={data.rawName}
               data-rawname={data.rawName}
               style={{
                 position: 'absolute', left: ax, top: ay, width: aw, height: ah,
                 background: colors.bg, borderRadius: 4,
                 overflow: 'hidden', boxSizing: 'border-box',
                 display: 'flex', flexDirection: 'column',
                 justifyContent: 'center', alignItems: 'center',
                 padding: pad, cursor: 'default',
                 outline: isHov ? '2px solid rgba(255,255,255,0.5)' : 'none',
                 outlineOffset: -2,
                 transition: 'outline 0.1s',
               }}
               onMouseEnter={e => {
                 const rect = containerRef.current.getBoundingClientRect();
                 setHovered({ data, x: e.clientX - rect.left, y: e.clientY - rect.top });
               }}
               onMouseMove={e => {
                 // Always set full data (not just x/y) — fixes Safari where onMouseEnter
                 // may not fire reliably when moving between sibling elements.
                 const rect = containerRef.current.getBoundingClientRect();
                 setHovered({ data, x: e.clientX - rect.left, y: e.clientY - rect.top });
               }}
               onTouchStart={e => {
                 const touch = e.touches[0];
                 const rect = containerRef.current.getBoundingClientRect();
                 setHovered({ data, x: touch.clientX - rect.left, y: touch.clientY - rect.top });
               }}>
            {showName && (
              <div style={{
                fontWeight: 700, fontSize: nameFz, color: colors.text,
                textAlign: 'center', lineHeight: 1.1,
                width: '100%', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {data.name}
              </div>
            )}
            {showPct && (
              <div style={{
                fontSize: pctFz, fontWeight: 600, color: colors.text,
                marginTop: 3, fontVariantNumeric: 'tabular-nums', textAlign: 'center',
              }}>
                {pctStr}
              </div>
            )}
          </div>
        );
      })}
      </div>{/* end inner box area */}
      {hovered && (
        <BentoTooltip
          data={hovered.data}
          sym={sym}
          x={hovered.x}
          y={hovered.y}
          containerW={containerW}
        />
      )}
    </div>
  );
}

// ── Par Value Reduction modal ──────────────────────────────────────────────────

function ParValueModal({ classKey, positionName, onClose }) {
  const [oldPar, setOldPar] = React.useState('10');
  const [newPar, setNewPar] = React.useState('');
  const [error,  setError]  = React.useState('');

  function apply() {
    const o = parseFloat(oldPar), n = parseFloat(newPar);
    if (!o || !n || o <= 0 || n <= 0) { setError('Enter valid positive numbers.'); return; }
    if (n >= o) { setError('New par must be less than old par.'); return; }
    const ratio = n / o;
    const pos   = Store.positions(classKey).find(p => p.name === positionName);
    const preview = pos ? `${window.fmtQty(pos.qty)} → ${window.fmtQty(+(pos.qty * ratio).toFixed(8))} shares` : '';
    if (!confirm(`Apply par value reduction ${o} → ${n} for ${positionName}?\n${preview}\n\nThis adjusts all lot quantities and buy prices. Cannot be undone.`)) return;
    Store.applyParValueReduction(classKey, positionName, o, n);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Par Value Reduction — ${positionName}`} width={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
          Adjusts all lot quantities by <b>newPar/oldPar</b> and buy prices inversely, so total cost is preserved.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Old par value</label>
            <input type="number" min="0.001" step="any" value={oldPar} onChange={e => { setOldPar(e.target.value); setError(''); }} autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">New par value</label>
            <input type="number" min="0.001" step="any" value={newPar} onChange={e => { setNewPar(e.target.value); setError(''); }} placeholder="e.g. 1" />
          </div>
        </div>
        {newPar && !error && parseFloat(newPar) > 0 && parseFloat(oldPar) > 0 && parseFloat(newPar) < parseFloat(oldPar) && (() => {
          const ratio = parseFloat(newPar) / parseFloat(oldPar);
          const pos   = Store.positions(classKey).find(p => p.name === positionName);
          if (!pos) return null;
          return (
            <div style={{ fontSize: 12, color: 'var(--fg-2)', background: 'var(--bg-sunken)', borderRadius: 6, padding: '8px 10px' }}>
              Qty: <b>{window.fmtQty(pos.qty)}</b> → <b>{window.fmtQty(+(pos.qty * ratio).toFixed(8))}</b><br />
              Avg cost: <b>{window.fmtPrice(pos.avgPrice, Store.classByKey(classKey).ccy)}</b> → <b>{window.fmtPrice(+(pos.avgPrice / ratio).toFixed(8), Store.classByKey(classKey).ccy)}</b>
            </div>
          );
        })()}
        {error && <div style={{ color: 'var(--red-600)', fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={apply} disabled={!newPar}>Apply</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Holdings table + view ─────────────────────────────────────────────────────

function HoldingsView({ classKey, onAdd, onEditLot }) {
  const cls       = Store.classByKey(classKey);
  const settings  = Store.settings();
  const positions = Store.positions(classKey);
  const totals    = Store.classTotals(classKey);
  const [expanded, setExpanded] = React.useState({});
  const [q, setQ] = React.useState('');
  const [chartName, setChartName] = React.useState(null);
  const [techSymbol, setTechSymbol] = React.useState(null);
  const [parValuePos, setParValuePos] = React.useState(null); // name of position for par value modal
  const [viewMode, setViewMode] = React.useState('table'); // 'table' | 'bento'
  const { sortBy, sortDir, handleSort } = useSortState();

  const hasChart   = cls.live && cls.live !== 'settrade';
  const hasDayChg  = !!cls.live; // all live-price classes show day change
  const hasPE      = cls.live === 'yahoo'; // P/E only from Yahoo Finance (stocks, ETFs, gold)
  const isLive     = !!cls.live;
  const isOther    = classKey === 'other';
  const isCrypto   = classKey === 'crypto';
  const liveNow    = cls.live === 'crypto' || (isLive && Store.get().priceMode === 'api');

  const filtered = positions.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.sector || '').toLowerCase().includes(q.toLowerCase())
  );
  const toggle = (n) => setExpanded(e => ({ ...e, [n]: !e[n] }));

  const sortedFiltered = sortBy ? [...filtered].sort((a, b) => {
    let av, bv;
    if (sortBy === 'sector' && isOther) {
      av = a.type || ''; bv = b.type || '';
    } else if (sortBy === 'dayPct') {
      av = Store.dayChangePct(classKey, a.name) ?? -Infinity;
      bv = Store.dayChangePct(classKey, b.name) ?? -Infinity;
    } else {
      av = a[sortBy] ?? ''; bv = b[sortBy] ?? '';
    }
    if (typeof av === 'string') return sortDir * bv.localeCompare(av);
    return sortDir * (bv - av);
  }) : filtered;

  // Resolve Yahoo symbol for technical modal
  function openTechnical(name) {
    const sym = window.resolveChartSymbol && window.resolveChartSymbol(classKey, name);
    if (sym) setTechSymbol(sym);
  }

  return (
    <React.Fragment>
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="t-h1" style={{ margin: 0 }}>{cls.label}</h1>
            {isLive && (liveNow
              ? <span className="livechip"><span className="blip" />Live · {cls.srcLabel}</span>
              : <span className="tag">Live via {cls.srcLabel} (deployed)</span>)}
          </div>
          <div className="t-small" style={{ marginTop: 3 }}>
            {totals.count} positions · prices in {cls.ccy}
            {!isOther && ' · click a current price to set it manually'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div className="layoutseg" style={{ flexShrink: 0 }}>
            <button className={viewMode === 'table' ? 'on' : ''} onClick={() => setViewMode('table')}>Table</button>
            <button className={viewMode === 'bento' ? 'on' : ''} onClick={() => setViewMode('bento')}>Bento</button>
          </div>
          <Button variant="accent" icon="plus" onClick={() => onAdd(classKey)}>Add holding</Button>
        </div>
      </div>

      {/* Class summary strip */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
        <div className="kpi"><div className="lab">Market Value ({cls.ccy})</div><div className="big">{window.fmtMoney(totals.valueNative, cls.ccy, 0)}</div></div>
        <div className="kpi"><div className="lab">Cost ({cls.ccy})</div><div className="big">{window.fmtMoney(totals.costNative, cls.ccy, 0)}</div></div>
        <div className="kpi">
          <div className="lab">Unrealized P/L</div>
          <div className={'big ' + (totals.profit >= 0 ? 'up' : 'down')}>
            {(totals.valueNative - totals.costNative >= 0 ? '+' : '−') + window.fmtMoney(Math.abs(totals.valueNative - totals.costNative), cls.ccy, 0)}
          </div>
          <div className={'delta ' + (totals.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(totals.pct)}</div>
        </div>
      </div>

      {isLive && !liveNow && (
        <div className="banner-soft" style={{ marginBottom: 16 }}>
          <Icon name="info" size={15} />
          <span>Live <b>{cls.srcLabel}</b> prices load from the bundled API once deployed to Vercel (browsers can't call {cls.srcLabel} directly). Showing your saved prices — click any current price to update it manually.</span>
        </div>
      )}

      <ClassAnalysis classKey={classKey} />

      {/* ── Bento view ── */}
      {viewMode === 'bento' && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-h">
            <div>
              <div className="t">Portfolio Bento</div>
              <div className="s">Box size = portfolio weight · color = today's return · hover for details</div>
            </div>
          </div>
          <div className="card-b">
            <BentoView classKey={classKey} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600 }}>Color scale:</span>
              {[
                { bg: '#1a7a3a',                  label: '≥ +3%',       text: '#fff' },
                { bg: 'rgba(48,209,88,0.22)',      label: '0% to +3%',  text: 'var(--fg-1)' },
                { bg: 'var(--bg-sunken)',          label: 'No change',  text: 'var(--fg-2)' },
                { bg: 'rgba(255,69,58,0.22)',      label: '-3% to 0%',  text: 'var(--fg-1)' },
                { bg: '#a01a1a',                  label: '≤ -3%',       text: '#fff' },
              ].map(({ bg, label, text }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, flexShrink: 0, border: '1px solid var(--border-1)' }} />
                  <span style={{ color: 'var(--fg-3)' }}>{label}</span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 4 }}>· Uses day % if available, falls back to total P/L %</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Table view ── */}
      {viewMode === 'table' && (
        <React.Fragment>
          <div className="toolbar2">
            <div className="search-inp">
              <Icon name="search" size={14} />
              <input placeholder={'Search ' + cls.label + '…'} value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="grow" />
            <span className="t-small">{filtered.length} of {positions.length}</span>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <table className="ptable">
              <thead>
                <tr>
                  <SortTh col="name"     label={isOther ? 'Name' : 'Ticker'}      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="sector"   label={isOther ? 'Type' : 'Sector'}       sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th>Tags</th>
                  <SortTh col="qty"      label="Units"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="avgPrice" label="Avg cost" right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="cur"      label="Current"  right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  {hasPE && !isOther && <th className="num" style={{ whiteSpace: 'nowrap' }}>P/E</th>}
                  {hasDayChg && !isOther && <SortTh col="dayPct" label="% Day" right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
                  <SortTh col="value"    label="Value"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="profit"   label="P/L"      right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="pct"      label="%"        right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th className="num" style={{ whiteSpace: 'nowrap', width: 80 }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.length === 0 && (
                  <tr><td colSpan={10 + (hasDayChg && !isOther ? 1 : 0) + (hasPE && !isOther ? 1 : 0)}><div className="empty">No holdings yet. <a className="t-link" onClick={() => onAdd(classKey)}>Add your first one →</a></div></td></tr>
                )}
                {sortedFiltered.map(p => {
                  const color   = window.CLASS_COLORS[classKey];
                  const open    = !!expanded[p.name];
                  const dayPct  = hasDayChg && !isOther ? Store.dayChangePct(classKey, p.name) : null;
                  const techSym = hasChart ? (window.resolveChartSymbol && window.resolveChartSymbol(classKey, p.name)) : null;

                  return (
                    <React.Fragment key={p.name}>
                      <tr className="pos" onClick={() => toggle(p.name)}>
                        <td>
                          <span className={'tk' + (open ? ' open' : '')}>
                            <span className="caret"><Icon name="chev-r" size={14} /></span>
                            <span className="av" style={{ background: color }}>{p.name.replace(/THB$/, '').slice(0, 3).toUpperCase()}</span>
                            <span>
                              {p.name.replace(/THB$/, '')}
                              {p.lots.length > 1 && <span style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--fg-4)', marginLeft: 7 }}>{p.lots.length} lots</span>}
                            </span>
                            {hasChart && (
                              <button className="chart-open-btn" title="Price chart"
                                      onClick={e => { e.stopPropagation(); setChartName(p.name); }}>
                                <Icon name="bar-chart-2" size={12} />
                              </button>
                            )}
                            {techSym && (
                              <button className="chart-open-btn" title="Technical analysis"
                                      style={{ color: 'var(--accent)' }}
                                      onClick={e => { e.stopPropagation(); setTechSymbol(techSym); }}>
                                <Icon name="activity" size={12} />
                              </button>
                            )}
                            {(classKey === 'thaiStock' || classKey === 'usaStock' || classKey === 'etf') && (
                              <button className="chart-open-btn" title="Par value reduction"
                                      style={{ color: 'var(--fg-3)' }}
                                      onClick={e => { e.stopPropagation(); setParValuePos(p.name); }}>
                                <Icon name="scissors" size={12} />
                              </button>
                            )}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {isOther ? <span className="tag">{p.type || '—'}</span> : isCrypto ? <span className="tag">Crypto</span> : <SectorChip position={p} classKey={classKey} />}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <PositionTagCell classKey={classKey} positionName={p.name} />
                        </td>
                        <td className="num">{window.fmtQty(p.qty)}</td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{window.fmtPrice(p.avgPrice, cls.ccy)}</td>
                        <td className="num" onClick={e => e.stopPropagation()}>
                          <PriceEdit position={p} classKey={classKey} ccy={cls.ccy} />
                          <PrePostBadge classKey={classKey} name={p.name} ccy={cls.ccy} />
                        </td>
                        {hasPE && !isOther && (
                          <td className="num">
                            {(() => {
                              const pe = Store.getPERatio(classKey, p.name);
                              return pe != null
                                ? <span style={{ fontSize: 12, color: pe > 40 ? 'var(--red-600)' : pe < 15 ? 'var(--green-600)' : 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{pe.toFixed(1)}x</span>
                                : <span style={{ color: 'var(--fg-4)', fontSize: 11 }}>—</span>;
                            })()}
                          </td>
                        )}
                        {hasDayChg && !isOther && (
                          <td className="num">
                            {dayPct != null
                              ? <span className={dayPct >= 0 ? 'up' : 'down'} style={{ fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                  {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                                </span>
                              : <span style={{ color: 'var(--fg-4)', fontSize: 11 }}>—</span>
                            }
                          </td>
                        )}
                        <td className="num">{window.fmtMoney(p.value, cls.ccy, 2)}</td>
                        <td className={'num ' + (p.profit >= 0 ? 'up' : 'down')}>{(p.profit >= 0 ? '+' : '−') + window.fmtMoney(Math.abs(p.profit), cls.ccy, 0)}</td>
                        <td className={'num ' + (p.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(p.pct)}</td>
                        <td className="num">
                          {(() => {
                            const allocPct = totals.valueNative > 0 ? (p.value / totals.valueNative) * 100 : 0;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-sunken)', overflow: 'hidden', flexShrink: 0 }}>
                                  <div style={{ width: Math.min(100, allocPct) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-3)', minWidth: 32 }}>{allocPct.toFixed(1)}%</span>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                      {open && <LotRows position={p} classKey={classKey} ccy={cls.ccy} onEdit={onEditLot} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </React.Fragment>
      )}
    </div>

    {chartName && (
      <PriceChartModal classKey={classKey} name={chartName} onClose={() => setChartName(null)} />
    )}
    {techSymbol && (
      <TechnicalModal symbol={techSymbol} onClose={() => setTechSymbol(null)} />
    )}
    {parValuePos && (
      <ParValueModal classKey={classKey} positionName={parValuePos} onClose={() => setParValuePos(null)} />
    )}
    </React.Fragment>
  );
}

window.HoldingsView = HoldingsView;
