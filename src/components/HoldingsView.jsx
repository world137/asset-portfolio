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
  if (v >= 3)   return { bg: '#1a7a3a', text: '#fff', border: 'transparent' };
  if (v >= 0)   return { bg: 'rgba(48,209,88,0.22)', text: 'var(--fg-1)', border: 'transparent' };
  if (v >= -3)  return { bg: 'rgba(255,69,58,0.22)', text: 'var(--fg-1)', border: 'transparent' };
  return              { bg: '#a01a1a', text: '#fff', border: 'transparent' };
}

function BentoView({ classKey }) {
  const positions    = Store.positions(classKey);
  const cls          = Store.classByKey(classKey);
  const settings     = Store.settings();
  const sym          = window.ccySymbol(settings.displayCcy);
  const containerRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(0);

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

  const items = positions
    .map(p => ({
      name:     p.name.replace(/THB$/, ''),
      rawName:  p.name,
      value:    Store.toDisplay(p.value, cls.ccy),
      dayPct:   Store.dayChangePct(classKey, p.name),
      totalPct: p.pct,
    }))
    .filter(i => i.value > 0);

  const BENTO_H = Math.max(260, Math.min(500, window.innerHeight * 0.5));
  const GAP     = 3;
  const rects   = containerW > 10 ? squarifiedTreemap(items, containerW, BENTO_H) : [];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: BENTO_H, overflow: 'hidden' }}>
      {rects.map(({ data, x, y, w, h }) => {
        const ax = x + GAP / 2, ay = y + GAP / 2;
        const aw = Math.max(0, w - GAP), ah = Math.max(0, h - GAP);
        const colors  = getDayChangeBg(data.dayPct, data.totalPct);
        const pct     = data.dayPct != null ? data.dayPct : data.totalPct;
        const pctStr  = pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' : null;

        // Font size scales with the smaller box dimension
        const minDim   = Math.min(aw, ah);
        const nameFz   = Math.min(24, Math.max(9,  minDim * 0.28));
        const pctFz    = Math.min(15, Math.max(8,  nameFz * 0.65));
        const showName = aw > 30  && ah > 24;
        const showPct  = aw > 44  && ah > 44 && pctStr != null;
        const pad      = Math.min(10, aw * 0.07);

        return (
          <div key={data.rawName}
               title={`${data.name}${pctStr ? '  ' + pctStr : ''}  ${sym}${window.fmtBig(data.value)}`}
               style={{
                 position: 'absolute', left: ax, top: ay, width: aw, height: ah,
                 background: colors.bg, borderRadius: 4,
                 overflow: 'hidden', boxSizing: 'border-box',
                 display: 'flex', flexDirection: 'column',
                 justifyContent: 'center', alignItems: 'center',
                 padding: pad, cursor: 'default',
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
    </div>
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
  const [viewMode, setViewMode] = React.useState('table'); // 'table' | 'bento'
  const { sortBy, sortDir, handleSort } = useSortState();

  const hasChart   = cls.live && cls.live !== 'settrade';
  const hasDayChg  = !!cls.live; // all live-price classes show day change
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
    const av = sortBy === 'sector' && isOther ? (a.type || '') : (a[sortBy] ?? '');
    const bv = sortBy === 'sector' && isOther ? (b.type || '') : (b[sortBy] ?? '');
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
              <div className="s">Box size = portfolio weight · color = today's return</div>
            </div>
          </div>
          <div className="card-b">
            <BentoView classKey={classKey} />
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
                  {hasDayChg && !isOther && <th className="num" style={{ whiteSpace: 'nowrap' }}>% Day</th>}
                  <SortTh col="value"    label="Value"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="profit"   label="P/L"      right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="pct"      label="%"        right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.length === 0 && (
                  <tr><td colSpan={hasDayChg && !isOther ? 10 : 9}><div className="empty">No holdings yet. <a className="t-link" onClick={() => onAdd(classKey)}>Add your first one →</a></div></td></tr>
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
    </React.Fragment>
  );
}

window.HoldingsView = HoldingsView;
