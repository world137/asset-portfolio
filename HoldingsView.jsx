/* eslint-disable */
/* HoldingsView.jsx — manage one asset class: positions, lots, inline edits */

function PriceEdit({ position, classKey, ccy }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState('');
  if (editing) {
    const commit = () => { if (v !== '' && !isNaN(+v)) Store.setCurrentPrice(classKey, position.name, +v); setEditing(false); };
    return (
      <input className="editprice" autoFocus type="number" step="any" defaultValue={position.cur}
             onChange={e => setV(e.target.value)}
             onBlur={commit}
             onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  return (
    <span onClick={(e) => { e.stopPropagation(); setV(''); setEditing(true); }}
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
  return <span className="sectorchip" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>{position.sector}</span>;
}

function LotRows({ position, classKey, ccy, onEdit }) {
  return (
    <tr className="lotrow">
      <td colSpan={8}>
        <div className="lotinner">
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
      </td>
    </tr>
  );
}

function ClassAnalysis({ classKey }) {
  const settings = Store.settings();
  const positions = Store.positions(classKey);
  const cls = Store.classByKey(classKey);
  const [hot, setHot] = React.useState(null);
  const isOther = classKey === 'other';
  const sym = window.ccySymbol(settings.displayCcy);

  const palette = ['#9a6b1f','#2962ab','#1f7a4d','#b6862f','#3b8bd0','#c79a3a','#8a6310','#5a6677','#b43a3a','#2c3a52','#7a5012','#1f4a85'];
  const map = new Map();
  for (const p of positions) {
    const key = isOther ? (p.type || '—') : (p.sector || '—');
    const v = Store.toDisplay(p.value, cls.ccy);
    map.set(key, (map.get(key) || 0) + v);
  }
  const segs = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
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
  const cls = Store.classByKey(classKey);
  const settings = Store.settings();
  const positions = Store.positions(classKey);
  const totals = Store.classTotals(classKey);
  const [expanded, setExpanded] = React.useState({});
  const [q, setQ] = React.useState('');
  const isLive = !!cls.live;
  const isOther = classKey === 'other';
  const priceMode = Store.get().priceMode;
  const liveNow = cls.live === 'crypto' || (isLive && priceMode === 'api');

  const filtered = positions.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.sector || '').toLowerCase().includes(q.toLowerCase()));
  const toggle = (n) => setExpanded(e => ({ ...e, [n]: !e[n] }));

  return (
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="accent" icon="plus" onClick={() => onAdd(classKey)}>Add holding</Button>
        </div>
      </div>

      {/* class summary strip */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
        <div className="kpi"><div className="lab">Market Value ({cls.ccy})</div><div className="big">{window.fmtMoney(totals.valueNative, cls.ccy, 0)}</div></div>
        <div className="kpi"><div className="lab">Cost ({cls.ccy})</div><div className="big">{window.fmtMoney(totals.costNative, cls.ccy, 0)}</div></div>
        <div className="kpi"><div className="lab">Unrealized P/L</div>
          <div className={'big ' + (totals.profit >= 0 ? 'up' : 'down')}>{(totals.valueNative - totals.costNative >= 0 ? '+' : '−') + window.fmtMoney(Math.abs(totals.valueNative - totals.costNative), cls.ccy, 0)}</div>
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

      <table className="ptable">
        <thead>
          <tr>
            <th>{isOther ? 'Name' : 'Ticker'}</th>
            <th>{isOther ? 'Type' : 'Sector'}</th>
            <th className="num">Units</th>
            <th className="num">Avg cost</th>
            <th className="num">Current</th>
            <th className="num">Value</th>
            <th className="num">P/L</th>
            <th className="num">%</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={8}><div className="empty">No holdings yet. <a className="t-link" onClick={() => onAdd(classKey)}>Add your first one →</a></div></td></tr>
          )}
          {filtered.map(p => {
            const color = window.CLASS_COLORS[classKey];
            const open = !!expanded[p.name];
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
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {isOther ? <span className="tag">{p.type || '—'}</span> : <SectorChip position={p} classKey={classKey} />}
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
  );
}

window.HoldingsView = HoldingsView;
