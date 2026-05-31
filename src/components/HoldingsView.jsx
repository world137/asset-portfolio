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
      <td colSpan={9}>
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

function HoldingsView({ classKey, onAdd, onEditLot }) {
  const cls       = Store.classByKey(classKey);
  const settings  = Store.settings();
  const positions = Store.positions(classKey);
  const totals    = Store.classTotals(classKey);
  const [expanded, setExpanded] = React.useState({});
  const [q, setQ] = React.useState('');
  const [chartName, setChartName] = React.useState(null);
  const { sortBy, sortDir, handleSort } = useSortState();

  const hasChart = cls.live && cls.live !== 'settrade';

  const isLive  = !!cls.live;
  const isOther  = classKey === 'other';
  const isCrypto = classKey === 'crypto';
  const liveNow = cls.live === 'crypto' || (isLive && Store.get().priceMode === 'api');

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
        <Button variant="accent" icon="plus" onClick={() => onAdd(classKey)}>Add holding</Button>
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
              <SortTh col="value"    label="Value"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="profit"   label="P/L"      right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="pct"      label="%"        right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.length === 0 && (
              <tr><td colSpan={9}><div className="empty">No holdings yet. <a className="t-link" onClick={() => onAdd(classKey)}>Add your first one →</a></div></td></tr>
            )}
            {sortedFiltered.map(p => {
              const color = window.CLASS_COLORS[classKey];
              const open  = !!expanded[p.name];
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
                    </td>
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
    </div>

    {chartName && (
      <PriceChartModal classKey={classKey} name={chartName} onClose={() => setChartName(null)} />
    )}
    </React.Fragment>
  );
}

window.HoldingsView = HoldingsView;
