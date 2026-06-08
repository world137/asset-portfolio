/* eslint-disable */
/* Dashboard.jsx — KPIs, allocation charts, per-class table. Three layouts. */

const BM_DEFS = [
  { key: 'SP500',  label: 'S&P 500', symbol: '^GSPC',  color: '#f97316' },
  { key: 'NASDAQ', label: 'NASDAQ',  symbol: '^IXIC',  color: '#8b5cf6' },
  { key: 'SET50',  label: 'SET',     symbol: '^SET.BK', color: '#3b82f6' },
];
// 5D uses 1mo to get daily bars (30m intraday is too noisy for daily-snapshot comparison)
const BM_RANGE_MAP = { '5D': '1mo', '1M': '1mo', '6M': '6mo', 'YTD': 'ytd', '1Y': '1y', '5Y': '5y', 'All': 'max' };

function PortfolioHistoryCard({ settings }) {
  const snapshots = Store.getSnapshots();
  const fxRate    = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;

  const [range,     setRangeState] = React.useState('1M');
  const [activeBMs, setActiveBMs]  = React.useState(new Set());
  const [bmCache,   setBmCache]    = React.useState({});
  const [bmLoading, setBmLoading]  = React.useState(new Set());

  async function fetchBM(key, symbol, r) {
    const ck = `${key}:${r}`;
    if (bmCache[ck]) return;
    setBmLoading(prev => new Set([...prev, key]));
    try {
      const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${BM_RANGE_MAP[r] || '1mo'}`);
      const j   = await res.json();
      if (j && j.points) setBmCache(prev => ({ ...prev, [ck]: j.points }));
    } catch (_) {}
    setBmLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  function toggleBM(key) {
    const def = BM_DEFS.find(d => d.key === key);
    setActiveBMs(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); return next; }
      next.add(key);
      fetchBM(key, def.symbol, range);
      return next;
    });
  }

  function handleRangeChange(r) {
    setRangeState(r);
    activeBMs.forEach(key => {
      const def = BM_DEFS.find(d => d.key === key);
      if (def) fetchBM(key, def.symbol, r);
    });
  }

  const benchmarks = BM_DEFS
    .filter(d => activeBMs.has(d.key))
    .map(d => ({ label: d.label, color: d.color, points: bmCache[`${d.key}:${range}`] || [] }))
    .filter(b => b.points.length > 0);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="card-h">
        <div>
          <div className="t">Portfolio History</div>
          <div className="s">Daily snapshots · valued in {settings.displayCcy} · snapshotted on price refresh</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {BM_DEFS.map(d => {
            const active  = activeBMs.has(d.key);
            const loading = bmLoading.has(d.key);
            return (
              <button key={d.key} onClick={() => toggleBM(d.key)} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                border: `1.5px solid ${active ? d.color : 'var(--border-2)'}`,
                color: active ? d.color : 'var(--fg-3)',
                background: active ? d.color + '1a' : 'transparent',
                transition: 'all 0.15s',
              }}>
                {loading ? '…' : d.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="card-b">
        <PortfolioLineChart
          snapshots={snapshots}
          displayCcy={settings.displayCcy}
          fxRate={fxRate}
          benchmarks={benchmarks}
          range={range}
          onRangeChange={handleRangeChange}
        />
      </div>
    </div>
  );
}

function AllocChart({ totals, settings, hot, setHot, onOpenClass, size }) {
  const disp = settings.displayCcy;
  const segs = totals.classes.map(c => ({ key: c.key, label: c.label, value: c.value, color: c.color }));
  return (
    <div className="chartwrap">
      <Donut
        segments={segs} size={size || 196} style={settings.chartStyle} hot={hot} onHover={setHot}
        center={
          <React.Fragment>
            <div className="c-lab">Total Value</div>
            <div className="c-val">{window.ccySymbol(disp)}{window.fmtBig(totals.value)}</div>
            <div className={'c-sub ' + (totals.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(totals.pct)}</div>
          </React.Fragment>
        }
      />
      <div className="legend">
        {segs.map((s, i) => {
          const pc = totals.value ? (s.value / totals.value) * 100 : 0;
          return (
            <div className="row" key={s.key}
                 onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                 onClick={() => onOpenClass(s.key)}>
              <span className="sw" style={{ background: s.color }} />
              <span className="nm">{s.label}</span>
              <span className="vv">{window.ccySymbol(disp)}{window.fmtBig(s.value)}</span>
              <span className="pc">{pc.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostChart({ totals, settings, hot, setHot, onOpenClass, size }) {
  const disp = settings.displayCcy;
  const sym  = window.ccySymbol(disp);
  const segs = totals.classes.map(c => ({ key: c.key, label: c.label, value: c.cost, color: c.color }));
  return (
    <div className="chartwrap">
      <Donut
        segments={segs} size={size || 196} style={settings.chartStyle} hot={hot} onHover={setHot}
        center={
          <React.Fragment>
            <div className="c-lab">Total Cost</div>
            <div className="c-val">{sym}{window.fmtBig(totals.cost)}</div>
          </React.Fragment>
        }
      />
      <div className="legend">
        {segs.map((s, i) => {
          const pc = totals.cost ? (s.value / totals.cost) * 100 : 0;
          return (
            <div className="row" key={s.key}
                 onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                 onClick={() => onOpenClass(s.key)}>
              <span className="sw" style={{ background: s.color }} />
              <span className="nm">{s.label}</span>
              <span className="vv">{sym}{window.fmtBig(s.value)}</span>
              <span className="pc">{pc.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiRow({ totals, settings }) {
  const sym = window.ccySymbol(settings.displayCcy);
  return (
    <div className="kpis">
      <div className="kpi accent">
        <div className="lab">Portfolio Value</div>
        <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totals.value)}</div>
        <div className={'delta ' + (totals.profit >= 0 ? 'up' : 'down')}>
          <Icon name={totals.profit >= 0 ? 'success' : 'warning'} size={13} />
          {window.fmtPct(totals.pct)} all-time
        </div>
      </div>
      <div className="kpi">
        <div className="lab">Total Cost</div>
        <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totals.cost)}</div>
        <div className="delta" style={{ color: 'var(--fg-3)' }}>{totals.classes.length} asset classes</div>
      </div>
      <div className="kpi">
        <div className="lab">Unrealized P/L</div>
        <div className={'big ' + (totals.profit >= 0 ? 'up' : 'down')}>
          <span className="ccy">{sym}</span>{(totals.profit >= 0 ? '+' : '−') + window.fmtBig(Math.abs(totals.profit))}
        </div>
        <div className={'delta ' + (totals.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(totals.pct)}</div>
      </div>
      <div className="kpi">
        <div className="lab">Holdings</div>
        <div className="big">{totals.classes.reduce((a, c) => a + c.count, 0)}</div>
        <div className="delta" style={{ color: 'var(--fg-3)' }}>positions tracked</div>
      </div>
    </div>
  );
}

function ClassTable({ totals, settings, onOpenClass, hot, setHot }) {
  const disp = settings.displayCcy;
  const { sortBy, sortDir, handleSort } = useSortState();

  const classesWithData = totals.classes.map((c, i) => ({
    ...c,
    alloc: totals.value ? (c.value / totals.value) * 100 : 0,
    origIdx: i,
  }));
  const sortedClasses = sortBy ? [...classesWithData].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    if (typeof av === 'string') return sortDir * bv.localeCompare(av);
    return sortDir * (bv - av);
  }) : classesWithData;

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="ptable">
        <thead>
          <tr>
            <SortTh col="label"  label="Asset Class"  sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            <SortTh col="alloc"  label="Allocation"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={150} />
            <SortTh col="value"  label="Value"  right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            <SortTh col="cost"   label="Cost"   right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            <SortTh col="profit" label="P/L"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            <SortTh col="pct"    label="%"      right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sortedClasses.map((c) => (
            <tr className="pos" key={c.key} onClick={() => onOpenClass(c.key)}
                onMouseEnter={() => setHot(c.origIdx)} onMouseLeave={() => setHot(null)}>
              <td>
                <span className="tk">
                  <span className="av" style={{ background: c.color, borderRadius: 7 }}>{c.label.slice(0, 2).toUpperCase()}</span>
                  {c.label}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="minibar" style={{ flex: 1 }}><span style={{ width: c.alloc + '%', background: c.color }} /></div>
                  <span style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--fg-3)', minWidth: 38, textAlign: 'right' }}>{c.alloc.toFixed(1)}%</span>
                </div>
              </td>
              <td className="num">{window.ccySymbol(disp)}{window.fmtBig(c.value)}</td>
              <td className="num" style={{ color: 'var(--fg-3)' }}>{window.ccySymbol(disp)}{window.fmtBig(c.cost)}</td>
              <td className={'num ' + (c.profit >= 0 ? 'up' : 'down')}>{(c.profit >= 0 ? '+' : '−') + window.ccySymbol(disp) + window.fmtBig(Math.abs(c.profit))}</td>
              <td className={'num ' + (c.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(c.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagDetailModal({ tag, onClose, onOpenClass }) {
  if (!tag) return null;
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  // Collect all positions that carry this tag, across all asset classes
  const tagged = [];
  for (const cls of window.ASSET_CLASSES) {
    for (const pos of Store.positions(cls.key)) {
      const tagIds = Store.getHoldingTags(cls.key + ':' + pos.name);
      if (!tagIds.includes(tag.id)) continue;
      const v = Store.toDisplay(pos.value, cls.ccy);
      const c = Store.toDisplay(pos.cost,  cls.ccy);
      tagged.push({ ...pos, classKey: cls.key, classLabel: cls.label, ccy: cls.ccy, valueDisp: v, costDisp: c });
    }
  }

  const totalValue  = tagged.reduce((a, p) => a + p.valueDisp, 0);
  const totalCost   = tagged.reduce((a, p) => a + p.costDisp,  0);
  const totalProfit = totalValue - totalCost;
  const totalPct    = totalCost ? (totalProfit / totalCost) * 100 : 0;

  const footer = (
    <React.Fragment>
      <span className="muted t-small">{tagged.length} position{tagged.length !== 1 ? 's' : ''}</span>
      <Button variant="ghost" onClick={onClose}>Close</Button>
    </React.Fragment>
  );

  return (
    <Modal open={true} onClose={onClose}
           title={tag.name}
           subtitle={'Assets tagged "' + tag.name + '" · click a row to open that class'}
           footer={footer} width={640}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: tag.color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>{tag.name}</span>
        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
          {sym}{window.fmtBig(totalValue)} total value
          <span className={totalProfit >= 0 ? ' up' : ' down'} style={{ marginLeft: 8 }}>
            {(totalProfit >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(totalProfit))} ({window.fmtPct(totalPct)})
          </span>
        </span>
      </div>

      {tagged.length === 0 ? (
        <div className="empty">No assets tagged "{tag.name}" yet. Go to any holding class and assign this tag in the Tags column.</div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="ptable">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Class</th>
                <th className="num">Value</th>
                <th className="num">Cost</th>
                <th className="num">P/L</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {tagged.map(p => (
                <tr key={p.classKey + ':' + p.name} className="pos"
                    onClick={() => { onClose(); onOpenClass(p.classKey); }}
                    title={'Open ' + p.classLabel}>
                  <td>
                    <span className="tk">
                      <span className="av" style={{ background: window.CLASS_COLORS[p.classKey], borderRadius: 7 }}>
                        {p.name.replace(/THB$/, '').slice(0, 3).toUpperCase()}
                      </span>
                      {p.name.replace(/THB$/, '')}
                    </span>
                  </td>
                  <td><span className="tag">{p.classLabel}</span></td>
                  <td className="num">{sym}{window.fmtBig(p.valueDisp)}</td>
                  <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(p.costDisp)}</td>
                  <td className={'num ' + (p.profit >= 0 ? 'up' : 'down')}>
                    {(p.profit >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(Store.toDisplay(p.profit, p.ccy)))}
                  </td>
                  <td className={'num ' + (p.pct >= 0 ? 'up' : 'down')}>{window.fmtPct(p.pct)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-1)', fontWeight: 600 }}>
                <td colSpan={2} style={{ color: 'var(--fg-2)', paddingTop: 8 }}>Total</td>
                <td className="num">{sym}{window.fmtBig(totalValue)}</td>
                <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(totalCost)}</td>
                <td className={'num ' + (totalProfit >= 0 ? 'up' : 'down')}>
                  {(totalProfit >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(totalProfit))}
                </td>
                <td className={'num ' + (totalPct >= 0 ? 'up' : 'down')}>{window.fmtPct(totalPct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}

function TagSummaryCard({ settings, onOpenClass }) {
  const tagData = Store.tagTotals();
  const totals  = Store.grandTotals();
  const sym     = window.ccySymbol(settings.displayCcy);
  const [activeTag,    setActiveTag]    = React.useState(null);
  const [editingTagId, setEditingTagId] = React.useState(null);
  const [editName,     setEditName]     = React.useState('');
  const [editColor,    setEditColor]    = React.useState('');

  if (!tagData.length) return null;

  const startEdit = (tag, e) => {
    e.stopPropagation();
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const commitEdit = (e) => {
    if (e) e.stopPropagation();
    if (!editName.trim()) return;
    Store.updateTag(editingTagId, { name: editName.trim(), color: editColor });
    setEditingTagId(null);
  };

  const cancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingTagId(null);
  };

  const handleDelete = (tag, e) => {
    e.stopPropagation();
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from all assets.`)) return;
    Store.deleteTag(tag.id);
    if (activeTag && activeTag.id === tag.id) setActiveTag(null);
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="card-h">
        <div>
          <div className="t">By Tag</div>
          <div className="s">{tagData.length} tag{tagData.length !== 1 ? 's' : ''} · click a row to see assets · use the edit/delete icons to manage tags</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="ptable">
          <thead>
            <tr>
              <th>Tag</th>
              <th style={{ width: 150 }}>Allocation</th>
              <th className="num">Value</th>
              <th className="num">Cost</th>
              <th className="num">P/L</th>
              <th className="num">%</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {tagData.map(({ tag, value, cost, profit, pct }) => {
              const alloc    = totals.value ? (value / totals.value) * 100 : 0;
              const isEditing = editingTagId === tag.id;
              return (
                <tr key={tag.id} className="pos"
                    style={{ cursor: isEditing ? 'default' : 'pointer' }}
                    onClick={() => !isEditing && setActiveTag(tag)}>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                           onClick={e => e.stopPropagation()}>
                        <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                               style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border-2)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }} />
                        <input className="input" style={{ flex: 1, fontSize: 13, padding: '3px 8px' }}
                               autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                               onKeyDown={e => { if (e.key === 'Enter') commitEdit(e); if (e.key === 'Escape') cancelEdit(e); }} />
                        <button onClick={commitEdit}
                                style={{ fontSize: 11, cursor: 'pointer', background: 'var(--accent,#2962ab)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 9px', flexShrink: 0 }}>
                          Save
                        </button>
                        <button onClick={cancelEdit}
                                style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, flexShrink: 0 }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: tag.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontWeight: 500 }}>{tag.name}</span>
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="minibar" style={{ flex: 1 }}><span style={{ width: alloc + '%', background: tag.color }} /></div>
                      <span style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--fg-3)', minWidth: 38, textAlign: 'right' }}>{alloc.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="num">{sym}{window.fmtBig(value)}</td>
                  <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(cost)}</td>
                  <td className={'num ' + (profit >= 0 ? 'up' : 'down')}>{(profit >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(profit))}</td>
                  <td className={'num ' + (pct >= 0 ? 'up' : 'down')}>{window.fmtPct(pct)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <span className="lotact">
                      <button title="Rename / recolor" onClick={e => startEdit(tag, e)}><Icon name="edit" size={13} /></button>
                      <button className="del" title="Delete tag" onClick={e => handleDelete(tag, e)}><Icon name="trash" size={13} /></button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeTag && (
        <TagDetailModal tag={activeTag} onClose={() => setActiveTag(null)} onOpenClass={onOpenClass} />
      )}
    </div>
  );
}

function Dashboard({ onOpenClass }) {
  const settings = Store.settings();
  const totals   = Store.grandTotals();
  const [hot, setHot] = React.useState(null);
  const layout = settings.layout;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Portfolio Overview</h1>
          <div className="t-small">All holdings, valued in {settings.displayCcy}. Click any class to manage holdings.</div>
        </div>
        <div className="layoutseg">
          {window.LAYOUT_OPTIONS.map(([v, l]) => (
            <button key={v} className={layout === v ? 'on' : ''} onClick={() => Store.setSetting('layout', v)}>{l}</button>
          ))}
        </div>
      </div>

      <KpiRow totals={totals} settings={settings} />

      {layout === 'overview' && (
        <React.Fragment>
          <div className="dash dash-2col">
            <div className="card">
              <div className="card-h"><div><div className="t">Cost by Asset Type</div><div className="s">Total invested</div></div></div>
              <div className="card-b"><CostChart totals={totals} settings={settings} hot={hot} setHot={setHot} onOpenClass={onOpenClass} /></div>
            </div>
            <div className="card">
              <div className="card-h"><div><div className="t">Current Value by Asset Type</div><div className="s">Market value today</div></div></div>
              <div className="card-b"><AllocChart totals={totals} settings={settings} hot={hot} setHot={setHot} onOpenClass={onOpenClass} /></div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-h"><div><div className="t">By Asset Class</div><div className="s">Click a row to open holdings</div></div></div>
            <ClassTable totals={totals} settings={settings} onOpenClass={onOpenClass} hot={hot} setHot={setHot} />
          </div>
        </React.Fragment>
      )}

      {layout === 'compact' && (
        <div className="card">
          <div className="card-h">
            <div><div className="t">Allocation & Performance</div><div className="s">{totals.classes.length} classes · valued in {settings.displayCcy}</div></div>
            <Donut segments={totals.classes.map(c => ({ value: c.value, color: c.color }))} size={64} style={settings.chartStyle} hot={hot} onHover={setHot} />
          </div>
          <ClassTable totals={totals} settings={settings} onOpenClass={onOpenClass} hot={hot} setHot={setHot} />
        </div>
      )}

      {layout === 'visual' && (
        <div className="dash dash-visual">
          <div className="card">
            <div className="card-b" style={{ display: 'flex', justifyContent: 'center', padding: '28px 18px 24px' }}>
              <AllocChart totals={totals} settings={settings} hot={hot} setHot={setHot} onOpenClass={onOpenClass} size={240} />
            </div>
          </div>
          <div className="classgrid">
            {totals.classes.map(c => {
              const pc = totals.value ? (c.value / totals.value) * 100 : 0;
              return (
                <div className="classcard" key={c.key} onClick={() => onOpenClass(c.key)}>
                  <div className="top"><span className="d" style={{ background: c.color }} /><span className="nm">{c.label}</span><span className="ct">{c.count}</span></div>
                  <div className="v">{window.ccySymbol(settings.displayCcy)}{window.fmtBig(c.value)}</div>
                  <div className="meta">
                    <span style={{ color: 'var(--fg-3)' }}>{pc.toFixed(1)}% of port</span>
                    <span className={c.profit >= 0 ? 'up' : 'down'}>{window.fmtPct(c.pct)}</span>
                  </div>
                  <div className="minibar" style={{ marginTop: 12 }}><span style={{ width: pc + '%', background: c.color }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PortfolioHistoryCard settings={settings} />
      <TagSummaryCard settings={settings} onOpenClass={onOpenClass} />
    </div>
  );
}

window.Dashboard = Dashboard;
