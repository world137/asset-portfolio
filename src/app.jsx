/* eslint-disable */
/* app.jsx — shell: navigation, routing, toolbar, settings */

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => Store.subscribe(force), []);
  return Store;
}

// ── Navigation sidebar ────────────────────────────────────────────────────────
function Nav({ route, setRoute, totals, open, onClose }) {
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  const NO_VAL_ROUTES = new Set(['dashboard','summary','networth','wallet','transactions','debts','walletsummary','walletcalendar','pixelworld','watchlist','sectors','selllog','technical','dayreport','rebalancing','dividends','goals','tax','benchmark','risk','alerts','planning']);

  const item = (key, label, icon, color) => (
    <div key={key} className={'item' + (route === key ? ' active' : '')} onClick={() => { setRoute(key); onClose(); }}>
      {color ? <span className="dot" style={{ background: color }} /> : <span className="ic"><Icon name={icon} size={16} /></span>}
      <span>{label}</span>
      {!NO_VAL_ROUTES.has(key) && (
        <span className="val">{sym}{window.fmtBig((totals.classes.find(c => c.key === key) || {}).value || 0)}</span>
      )}
    </div>
  );

  return (
    <aside className={'nav' + (open ? ' open' : '')}>
      <div className="brand">
        <span className="mark">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>
        </span>
        <span className="wm">Portfolio<small>Asset Tracker</small></span>
      </div>
      <div className="scroll">
        {item('dashboard', 'Dashboard', 'home')}
        {item('networth',  'Net Worth', 'shield')}
        <div className="grp-h">Holdings</div>
        {window.ASSET_CLASSES.map(c => item(c.key, c.label, null, window.CLASS_COLORS[c.key]))}
        <div className="grp-h">Analysis</div>
        {item('sectors',    'By Sector',    'pie-chart')}
        {item('summary',    'Cost vs Price','bar-chart-2')}
        {item('rebalancing','Rebalancing',  'sliders')}
        {item('benchmark',  'Benchmark',    'trending-up')}
        {item('risk',       'Risk Analysis','shield')}
        {item('goals',      'Goals',        'target')}
        {item('dividends',  'Dividends',    'dollar-sign')}
        {item('tax',        'Tax Summary',  'file-text')}
        {item('planning',   'Planning',     'calendar')}
        {item('alerts',     'Alerts',       'bell')}
        {item('selllog',    'Sell Log',     'trending-down')}
        {item('dayreport',  'Day Report',   'send')}
        {item('watchlist',  'Watchlist',    'eye')}
        {item('technical',  'Technical',    'activity')}
        <div className="grp-h">Wallet</div>
        {item('wallet',         'Accounts',     'wallet')}
        {item('transactions',   'Transactions', 'repeat')}
        {item('debts',          'Debts',        'credit-card')}
        {item('walletsummary',  'Summary',      'sliders')}
        {item('walletcalendar', 'Calendar',     'calendar')}
        <div className="grp-h">Fun</div>
        {item('pixelworld', 'Pixel Office', 'cpu')}
      </div>
      <div className="foot">
        <span className="av">PT</span>
        <div>
          <div className="who" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(window._ptfUsername && window._ptfUsername()) || 'My Portfolio'}
            <span className="logout-btn" title="Sign out" onClick={window._ptfLogout}>
              <Icon name="log-out" size={13} />
            </span>
          </div>
          <div className="sub" style={{ display: 'flex', gap: 6 }}>
            <span style={{ cursor: 'pointer' }}
                  title={'Sync ID: ' + Store.getPortfolioId() + '\nClick to copy'}
                  onClick={() => {
                    const id = Store.getPortfolioId();
                    (navigator.clipboard
                      ? navigator.clipboard.writeText(id).catch(() => window.prompt('Sync ID (copy):', id))
                      : Promise.resolve(window.prompt('Sync ID (copy):', id)));
                  }}>
              ☁ {Store.getPortfolioId().slice(0, 8)}…
            </span>
            <span style={{ cursor: 'pointer', opacity: 0.55 }}
                  onClick={() => {
                    const id = (window.prompt('Enter Sync ID to load from another device:') || '').trim();
                    if (id) Store.setPortfolioId(id);
                  }}>
              switch
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── DB status indicator ───────────────────────────────────────────────────────
function DbStatusBadge() {
  useStore();
  const { status, savedAt } = Store.getDbStatus();
  const label = status === 'pending' || status === 'saving' ? 'Saving…'
    : status === 'saved'  ? 'DB saved'
    : status === 'error'  ? 'DB error'
    : null;
  if (!label) return null;
  const color = status === 'error' ? 'var(--red-600)' : status === 'saved' ? 'var(--green-600)' : 'var(--fg-3)';
  return (
    <span title={status === 'saved' && savedAt ? 'Saved ' + window.timeAgo(savedAt) : label}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color, fontWeight: 500, userSelect: 'none' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color,
                     animation: (status === 'pending' || status === 'saving') ? 'pulse 1s infinite' : 'none' }} />
      {label}
    </span>
  );
}

// ── Cost & Price Summary view ─────────────────────────────────────────────────
function SummaryView() {
  const settings = Store.settings();
  const disp     = settings.displayCcy;
  const sym      = window.ccySymbol(disp);
  const { sortBy, sortDir, handleSort } = useSortState('value');
  const [filterClass, setFilterClass] = React.useState('all');
  const [hot, setHot] = React.useState(null);

  // Build one row per aggregated position, converting prices into display currency.
  const rows = [];
  for (const cls of window.ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      const value    = Store.toDisplay(p.value, cls.ccy);
      const cost     = Store.toDisplay(p.cost,  cls.ccy);
      const curDisp  = Store.toDisplay(p.cur,      cls.ccy);
      const avgDisp  = Store.toDisplay(p.avgPrice,  cls.ccy);
      rows.push({
        classKey: cls.key, classLabel: cls.label, classColor: window.CLASS_COLORS[cls.key],
        name: p.name, sector: p.sector, ccy: cls.ccy,
        qty: p.qty, avgPriceDisp: avgDisp, curDisp,
        cost, value, profit: value - cost,
        pct:      cost ? ((value - cost) / cost) * 100 : 0,
        priceChg: p.avgPrice ? ((p.cur - p.avgPrice) / p.avgPrice) * 100 : 0,
      });
    }
  }
  const totalPortValue = rows.reduce((a, r) => a + r.value, 0) || 1;

  const filtered = filterClass === 'all' ? rows : rows.filter(r => r.classKey === filterClass);
  const sorted   = [...filtered].sort((a, b) => sortDir * (b[sortBy] - a[sortBy]));

  const filtTotals = sorted.reduce((a, r) => ({ cost: a.cost + r.cost, value: a.value + r.value, profit: a.profit + r.profit }), { cost: 0, value: 0, profit: 0 });
  const filtPct    = filtTotals.cost ? (filtTotals.profit / filtTotals.cost) * 100 : 0;

  // Build sector segments using the shared palette.
  const secMap = new Map();
  for (const r of filtered) {
    const key   = r.sector || '—';
    const entry = secMap.get(key) || { cost: 0, value: 0 };
    entry.cost  += r.cost;
    entry.value += r.value;
    secMap.set(key, entry);
  }
  const secEntries     = [...secMap.entries()].sort((a, b) => b[1].value - a[1].value);
  const totalSecValue  = secEntries.reduce((a, [, e]) => a + e.value, 0) || 1;
  const totalSecCost   = secEntries.reduce((a, [, e]) => a + e.cost,  0) || 1;
  const secSegs = secEntries.map(([label, e], i) => ({
    label, value: e.value, cost: e.cost,
    color: window.SECTOR_PALETTE[i % window.SECTOR_PALETTE.length],
    alloc:     (e.value / totalSecValue) * 100,
    costAlloc: (e.cost  / totalSecCost)  * 100,
  }));
  const secCostSegs = secSegs.map(s => ({ ...s, value: s.cost }));

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Cost &amp; Price Summary</h1>
          <div className="t-small">{rows.length} positions across all asset classes · valued in {disp}</div>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <div className="layoutseg" style={{ whiteSpace: 'nowrap' }}>
            <button className={filterClass === 'all' ? 'on' : ''} onClick={() => setFilterClass('all')}>All</button>
            {window.ASSET_CLASSES.map(c => (
              <button key={c.key} className={filterClass === c.key ? 'on' : ''} onClick={() => setFilterClass(c.key)}>{c.short}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi accent">
          <div className="lab">Current Value</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(filtTotals.value)}</div>
          <div className={'delta ' + (filtPct >= 0 ? 'up' : 'down')}>{window.fmtPct(filtPct)} all-time</div>
        </div>
        <div className="kpi">
          <div className="lab">Total Cost</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(filtTotals.cost)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{sorted.length} positions shown</div>
        </div>
        <div className="kpi">
          <div className="lab">Unrealized P/L</div>
          <div className={'big ' + (filtTotals.profit >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{(filtTotals.profit >= 0 ? '+' : '−') + window.fmtBig(Math.abs(filtTotals.profit))}
          </div>
          <div className={'delta ' + (filtPct >= 0 ? 'up' : 'down')}>{window.fmtPct(filtPct)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Best Performer</div>
          {(() => {
            const best = sorted.length ? [...sorted].sort((a, b) => b.pct - a.pct)[0] : null;
            return best
              ? <React.Fragment>
                  <div className="big" style={{ fontSize: 20 }}>{best.name.replace(/THB$/, '')}</div>
                  <div className="delta up">{window.fmtPct(best.pct)}</div>
                </React.Fragment>
              : <div className="big">—</div>;
          })()}
        </div>
      </div>

      {secSegs.length > 0 && (
        <div className="dash dash-2col" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-h"><div><div className="t">Cost by Sector</div><div className="s">{filterClass === 'all' ? 'All classes' : (window.ASSET_CLASSES.find(c => c.key === filterClass) || {}).label} · total invested</div></div></div>
            <div className="card-b">
              <div className="chartwrap">
                <Donut segments={secCostSegs} size={196} style={settings.chartStyle} hot={hot} onHover={setHot}
                       center={<React.Fragment><div className="c-lab">Cost</div><div className="c-val">{sym}{window.fmtBig(totalSecCost)}</div></React.Fragment>} />
                <div className="legend">
                  {secSegs.map((s, i) => (
                    <div className="row" key={s.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                      <span className="sw" style={{ background: s.color }} />
                      <span className="nm">{s.label}</span>
                      <span className="vv">{sym}{window.fmtBig(s.cost)}</span>
                      <span className="pc">{s.costAlloc.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><div><div className="t">Current Value by Sector</div><div className="s">Market value today</div></div></div>
            <div className="card-b">
              <div className="chartwrap">
                <Donut segments={secSegs} size={196} style={settings.chartStyle} hot={hot} onHover={setHot}
                       center={<React.Fragment><div className="c-lab">Value</div><div className="c-val">{sym}{window.fmtBig(totalSecValue)}</div></React.Fragment>} />
                <div className="legend">
                  {secSegs.map((s, i) => (
                    <div className="row" key={s.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                      <span className="sw" style={{ background: s.color }} />
                      <span className="nm">{s.label}</span>
                      <span className="vv">{sym}{window.fmtBig(s.value)}</span>
                      <span className="pc">{s.alloc.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <div><div className="t">All Positions</div><div className="s">Click column headers to sort</div></div>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table className="ptable" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Ticker / Name</th>
                <th>Sector / Type</th>
                <SortTh col="qty"          label="Units"      right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="avgPriceDisp" label="Avg Cost"   right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="curDisp"      label="Current"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="num" style={{ width: 120 }}>Cost vs Price</th>
                <SortTh col="cost"         label="Total Cost" right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="value"        label="Value"      right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="profit"       label="P/L"        right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="pct"          label="%"          right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="num" style={{ whiteSpace: 'nowrap', width: 80 }}>Port %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={12}><div className="empty">No holdings found.</div></td></tr>
              )}
              {sorted.map((r, i) => {
                const barMax = Math.max(r.cost, r.value) || 1;
                const costW  = (r.cost  / barMax) * 100;
                const valW   = (r.value / barMax) * 100;
                const isUp   = r.profit >= 0;
                return (
                  <tr key={r.classKey + ':' + r.name + ':' + i} className="pos">
                    <td>
                      <span className="tk">
                        <span className="av" style={{ background: r.classColor, borderRadius: 7 }}>{r.classLabel.slice(0, 2).toUpperCase()}</span>
                        <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{r.classLabel}</span>
                      </span>
                    </td>
                    <td><span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--fg-1)' }}>{r.name.replace(/THB$/, '')}</span></td>
                    <td><span className="sectorchip" style={{ cursor: 'default' }}>{r.sector}</span></td>
                    <td className="num">{window.fmtQty(r.qty)}</td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(r.avgPriceDisp)}</td>
                    <td className="num">
                      <span className={r.priceChg >= 0 ? 'up' : 'down'} style={{ fontWeight: 600 }}>
                        {sym}{window.fmtBig(r.curDisp)}
                      </span>
                      <span style={{ display: 'block', font: '500 10.5px/1 var(--font-mono)', color: r.priceChg >= 0 ? 'var(--green-600)' : 'var(--red-600)', marginTop: 3 }}>
                        {r.priceChg >= 0 ? '▲' : '▼'} {Math.abs(r.priceChg).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <div className="costbar-wrap">
                        <div className="costbar" title={`Cost: ${sym}${window.fmtBig(r.cost)}`}   style={{ width: costW + '%', background: 'var(--fg-4)' }} />
                        <div className="costbar" title={`Value: ${sym}${window.fmtBig(r.value)}`} style={{ width: valW + '%', background: isUp ? 'var(--green-600)' : 'var(--red-600)', opacity: 0.7 }} />
                      </div>
                    </td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(r.cost)}</td>
                    <td className="num">{sym}{window.fmtBig(r.value)}</td>
                    <td className={'num ' + (r.profit >= 0 ? 'up' : 'down')}>
                      {(r.profit >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(r.profit))}
                    </td>
                    <td className={'num ' + (r.pct >= 0 ? 'up' : 'down')}>{window.fmtPct(r.pct)}</td>
                    <td className="num">
                      {(() => {
                        const portPct = (r.value / totalPortValue) * 100;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-sunken)', overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ width: Math.min(100, portPct * 5) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-3)', minWidth: 36 }}>{portPct.toFixed(1)}%</span>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PortfolioGrowthPanel />
    </div>
  );
}

// ── Portfolio Growth Panel ────────────────────────────────────────────────────
function PortfolioGrowthPanel() {
  const snapshots = Store.getSnapshots();
  if (!snapshots || snapshots.length < 2) {
    return (
      <div className="card" style={{ padding: '20px 18px' }}>
        <div className="card-h"><div><div className="t">Portfolio Growth</div><div className="s">Needs 2+ daily snapshots to calculate returns</div></div></div>
        <div style={{ color: 'var(--fg-3)', fontSize: 13, padding: '12px 0' }}>
          Not enough snapshot history yet. Returns will appear after the portfolio has been open on multiple days.
        </div>
      </div>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];
  const now     = new Date();
  const nowStr  = now.toISOString().slice(0, 10);

  function findPast(daysBack, ytd, maxPeriod) {
    if (maxPeriod) return sorted[0];
    if (ytd) {
      const ytdDate = now.getFullYear() + '-01-01';
      const snap = sorted.filter(s => s.date < ytdDate).sort((a, b) => b.date.localeCompare(a.date))[0];
      return snap || null;
    }
    const target = new Date(now.getTime() - daysBack * 86400000).toISOString().slice(0, 10);
    return sorted.filter(s => s.date <= target).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }

  const PERIODS = [
    { label: '1D',  days: 1   },
    { label: '5D',  days: 5   },
    { label: '1M',  days: 30  },
    { label: '6M',  days: 180 },
    { label: 'YTD', ytd: true },
    { label: '1Y',  days: 365 },
    { label: '5Y',  days: 1825},
    { label: 'MAX', max: true },
  ];

  function pct(curr, past, key) {
    const c = key ? (curr[key] ?? null) : curr.value;
    const p = key ? (past[key] ?? null) : past.value;
    if (c == null || p == null || p === 0) return null;
    return (c - p) / p * 100;
  }

  const classes = window.ASSET_CLASSES.filter(cls => {
    const total = snapshots.some(s => s[cls.key] != null && s[cls.key] > 0);
    return total;
  });

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h" style={{ padding: '14px 18px' }}>
        <div>
          <div className="t">Portfolio Growth</div>
          <div className="s">Price return by period · snapshot-based · in THB · excludes unrealized impact of sell log</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="ptable" style={{ minWidth: 580 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>Period</th>
              <th className="num" style={{ color: 'var(--fg-1)', fontWeight: 700 }}>All</th>
              {classes.map(cls => (
                <th key={cls.key} className="num">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: window.CLASS_COLORS[cls.key], display: 'inline-block', marginRight: 4 }} />
                  {cls.short || cls.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(({ label, days, ytd, max }) => {
              const past = findPast(days, ytd, max);
              if (!past) {
                return (
                  <tr key={label}>
                    <td style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)' }}>{label}</td>
                    <td className="num" colSpan={classes.length + 1} style={{ color: 'var(--fg-4)', fontSize: 12 }}>No data</td>
                  </tr>
                );
              }
              const totalPct = pct(current, past, null);
              return (
                <tr key={label}>
                  <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{label}</td>
                  <td className={'num ' + (totalPct == null ? '' : totalPct >= 0 ? 'up' : 'down')} style={{ fontWeight: 700 }}>
                    {totalPct == null ? '—' : (totalPct >= 0 ? '+' : '') + totalPct.toFixed(2) + '%'}
                  </td>
                  {classes.map(cls => {
                    const v = pct(current, past, cls.key);
                    return (
                      <td key={cls.key} className={'num ' + (v == null ? '' : v >= 0 ? 'up' : 'down')} style={{ fontSize: 12 }}>
                        {v == null ? <span style={{ color: 'var(--fg-4)' }}>—</span> : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-sunken)' }}>
              <td colSpan={classes.length + 2} style={{ padding: '8px 18px', fontSize: 11, color: 'var(--fg-4)' }}>
                Based on {sorted.length} daily snapshots · from {sorted[0].date} · last updated {current.date}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Sector drill-down modal ───────────────────────────────────────────────────
function SectorDrillModal({ sector, color, onClose }) {
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  // Gather all positions in this sector, grouped by asset class
  const byClass = new Map();
  for (const cls of window.ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      const sec = cls.key === 'crypto' ? 'Crypto' : (p.sector || '—');
      if (sec !== sector) continue;
      if (!byClass.has(cls.key)) byClass.set(cls.key, { cls, positions: [] });
      byClass.get(cls.key).positions.push(p);
    }
  }

  const groups = [...byClass.values()];
  const totalValue = groups.reduce((a, g) =>
    a + g.positions.reduce((s, p) => s + Store.toDisplay(p.value, g.cls.ccy), 0), 0);

  return (
    <Modal open onClose={onClose} title={`Sector: ${sector}`} width={640}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
        <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>
          {groups.reduce((a, g) => a + g.positions.length, 0)} positions ·{' '}
          <strong style={{ color: 'var(--fg-1)' }}>{sym}{window.fmtBig(totalValue)}</strong> total
        </span>
      </div>

      {groups.length === 0 && (
        <div style={{ color: 'var(--fg-3)', fontSize: 13, padding: '20px 0' }}>No positions found in this sector.</div>
      )}

      {groups.map(({ cls, positions }) => (
        <div key={cls.key} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: window.CLASS_COLORS[cls.key], display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg-1)' }}>{cls.label}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="ptable" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="num">Units</th>
                <th className="num">Current</th>
                <th className="num">Value</th>
                <th className="num">P/L</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const dispVal  = Store.toDisplay(p.value, cls.ccy);
                const dispProf = Store.toDisplay(p.profit, cls.ccy);
                return (
                  <tr key={p.name} className="pos">
                    <td>
                      <span className="tk">
                        <span className="av" style={{ background: window.CLASS_COLORS[cls.key] }}>
                          {p.name.replace(/THB$/, '').slice(0, 3).toUpperCase()}
                        </span>
                        {p.name.replace(/THB$/, '')}
                      </span>
                    </td>
                    <td className="num">{window.fmtQty(p.qty)}</td>
                    <td className="num">{window.fmtPrice(p.cur, cls.ccy)}</td>
                    <td className="num">{sym}{window.fmtBig(dispVal)}</td>
                    <td className={'num ' + (p.profit >= 0 ? 'up' : 'down')}>
                      {(p.profit >= 0 ? '+' : '−')}{sym}{window.fmtBig(Math.abs(dispProf))}
                    </td>
                    <td className={'num ' + (p.pct >= 0 ? 'up' : 'down')}>{window.fmtPct(p.pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </Modal>
  );
}

// ── Allocation by Sector view ─────────────────────────────────────────────────
function SectorView() {
  const settings   = Store.settings();
  const secs       = Store.sectorTotals();
  const totalValue = secs.reduce((a, s) => a + s.value, 0) || 1;
  const totalCost  = secs.reduce((a, s) => a + s.cost,  0) || 1;
  const sym        = window.ccySymbol(settings.displayCcy);
  const [hot, setHot] = React.useState(null);
  const [drillSector, setDrillSector] = React.useState(null);
  const { sortBy, sortDir, handleSort } = useSortState();

  const segs = secs.map((s, i) => ({
    label: s.sector, value: s.value, cost: s.cost,
    color: window.SECTOR_PALETTE[i % window.SECTOR_PALETTE.length],
    alloc:     (s.value / totalValue) * 100,
    costAlloc: (s.cost  / totalCost)  * 100,
    profit:    s.value - s.cost,
    pct:       s.cost ? ((s.value - s.cost) / s.cost) * 100 : 0,
    origIdx: i,
  }));
  const costSegs = segs.map(s => ({ ...s, value: s.cost }));
  const sortedSegs = sortBy ? [...segs].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    if (typeof av === 'string') return sortDir * bv.localeCompare(av);
    return sortDir * (bv - av);
  }) : segs;

  const drillSeg = drillSector ? segs.find(s => s.label === drillSector) : null;

  return (
    <div className="page">
      <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Allocation by Sector</h1>
      <div className="t-small" style={{ marginBottom: 20 }}>Across every asset class, valued in {settings.displayCcy}. Edit a holding's sector from its class page. Click a row to drill down.</div>
      <div className="dash dash-2col">
        <div className="card">
          <div className="card-h"><div className="t">Cost by Sector</div><div className="s">Total invested</div></div>
          <div className="card-b">
            <div className="chartwrap">
              <Donut segments={costSegs} size={196} style={settings.chartStyle} hot={hot} onHover={setHot}
                     center={<React.Fragment><div className="c-lab">Cost</div><div className="c-val">{sym}{window.fmtBig(totalCost)}</div></React.Fragment>} />
              <div className="legend">
                {segs.map((s, i) => (
                  <div className="row" key={s.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                       onClick={() => setDrillSector(s.label)} style={{ cursor: 'pointer' }}>
                    <span className="sw" style={{ background: s.color }} />
                    <span className="nm">{s.label}</span>
                    <span className="vv">{sym}{window.fmtBig(s.cost)}</span>
                    <span className="pc">{s.costAlloc.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><div className="t">Current Value by Sector</div><div className="s">Market value today</div></div>
          <div className="card-b">
            <div className="chartwrap">
              <Donut segments={segs} size={196} style={settings.chartStyle} hot={hot} onHover={setHot}
                     center={<React.Fragment><div className="c-lab">Value</div><div className="c-val">{sym}{window.fmtBig(totalValue)}</div></React.Fragment>} />
              <div className="legend">
                {segs.map((s, i) => (
                  <div className="row" key={s.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                       onClick={() => setDrillSector(s.label)} style={{ cursor: 'pointer' }}>
                    <span className="sw" style={{ background: s.color }} />
                    <span className="nm">{s.label}</span>
                    <span className="vv">{sym}{window.fmtBig(s.value)}</span>
                    <span className="pc">{s.alloc.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><div className="t">Sector Breakdown</div><div className="s">Click a row to see assets in that sector</div></div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="ptable">
            <thead><tr>
              <SortTh col="label"  label="Sector"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="alloc"  label="Weight"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={140} />
              <SortTh col="cost"   label="Cost"  right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="value"  label="Value" right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="profit" label="Gain/Loss" right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="pct"    label="Return"    right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            </tr></thead>
            <tbody>
              {sortedSegs.map((s) => (
                <tr key={s.label} className="pos"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHot(s.origIdx)} onMouseLeave={() => setHot(null)}
                    onClick={() => setDrillSector(s.label)}>
                  <td><span className="tk"><span className="d" style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />{s.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="minibar" style={{ flex: 1 }}><span style={{ width: s.alloc + '%', background: s.color }} /></div>
                      <span style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--fg-3)', minWidth: 38, textAlign: 'right' }}>{s.alloc.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="num">{sym}{window.fmtBig(s.cost)}</td>
                  <td className="num">{sym}{window.fmtBig(s.value)}</td>
                  <td className="num" style={{ color: s.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>{s.profit >= 0 ? '+' : ''}{sym}{window.fmtBig(s.profit)}</td>
                  <td className="num" style={{ color: s.pct >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>{s.pct >= 0 ? '+' : ''}{s.pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drillSector && drillSeg && (
        <SectorDrillModal
          sector={drillSector}
          color={drillSeg.color}
          onClose={() => setDrillSector(null)}
        />
      )}
    </div>
  );
}

// ── Bottom Tab Navigation (mobile only, ≤760px) ───────────────────────────────
function BottomNav({ route, setRoute, onOpenDrawer }) {
  const tabs = [
    { key: 'dashboard', label: 'Home',     icon: 'home'      },
    { key: 'networth',  label: 'Net Worth',icon: 'shield'    },
    { key: 'wallet',    label: 'Wallet',   icon: 'wallet'    },
    { key: 'summary',   label: 'Analysis', icon: 'pie-chart' },
    { key: '__more__',  label: 'More',     icon: 'grid'      },
  ];

  const isActive = (key) => {
    if (key === '__more__') return false;
    return route === key;
  };

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(t => (
        <button
          key={t.key}
          className={'bottom-tab' + (isActive(t.key) ? ' active' : '')}
          onClick={() => t.key === '__more__' ? onOpenDrawer() : setRoute(t.key)}
          aria-label={t.label}
        >
          <Icon name={t.icon} size={24} stroke={isActive(t.key) ? 2.2 : 1.7} />
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
function App() {
  useStore();
  const settings = Store.settings();
  const totals   = Store.grandTotals();
  const [route,   setRoute]  = React.useState('dashboard');
  const [drawer,  setDrawer] = React.useState(false);
  const [modal,   setModal]  = React.useState({ open: false, classKey: null, lot: null });
  const [syncing,     setSyncing]   = React.useState(false);
  const [dbReady,     setDbReady]   = React.useState(false);
  const [dtOpen,      setDtOpen]    = React.useState(false);
  const [mobileMenu,  setMobileMenu] = React.useState(false);

  React.useEffect(() => { document.documentElement.setAttribute('data-theme', settings.theme); }, [settings.theme]);

  React.useEffect(() => {
    Store.loadFromCloud().then(loaded => {
      if (loaded) Store.autoSnapshot();
      setDbReady(true);
    });
    Store.loadWalletFromCloud();
  }, []);

  React.useEffect(() => {
    if (!dbReady) return;
    const maybeRefresh = () => {
      const last = Store.get().lastPriceSync;
      if (!last || Date.now() - last >= window.PRICE_REFRESH_MS) refresh();
    };
    maybeRefresh();
    const timer = setInterval(refresh, window.PRICE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [dbReady]);

  const openAdd  = (classKey) => setModal({ open: true, classKey, lot: null });
  const openEdit = (lot) => setModal({ open: true, classKey: route, lot });
  const closeModal = () => setModal({ open: false, classKey: null, lot: null });

  const refresh = async () => {
    setSyncing(true);
    await Store.refreshPrices();
    setSyncing(false);
  };

  if (!dbReady) {
    return (
      <div className="goog-loading-shell">
        {/* Google-style top progress bar */}
        <div className="goog-loading-bar">
          <div className="goog-loading-bar-fill" />
        </div>
        {/* Centered content */}
        <div className="goog-loading-body">
          <div className="goog-loading-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
            </svg>
          </div>
          <div className="goog-loading-product">Portfolio Tracker</div>
          <div className="goog-loading-sub">Loading your portfolio…</div>
        </div>
      </div>
    );
  }

  const title = route === 'dashboard'    ? 'Dashboard'
    : route === 'networth'       ? 'Net Worth'
    : route === 'sectors'        ? 'Analysis'
    : route === 'summary'        ? 'Cost & Price Summary'
    : route === 'rebalancing'    ? 'Rebalancing'
    : route === 'benchmark'      ? 'Benchmark Comparison'
    : route === 'risk'           ? 'Risk Analysis'
    : route === 'goals'          ? 'Financial Goals'
    : route === 'dividends'      ? 'Dividend Calendar'
    : route === 'tax'            ? 'Tax Summary'
    : route === 'planning'       ? 'Planning & Projections'
    : route === 'alerts'         ? 'Price Alerts'
    : route === 'selllog'        ? 'Sell Log'
    : route === 'wallet'         ? 'Accounts'
    : route === 'transactions'   ? 'Transactions'
    : route === 'debts'          ? 'Debts'
    : route === 'walletsummary'  ? 'Wallet Summary'
    : route === 'walletcalendar' ? 'Calendar'
    : route === 'pixelworld'     ? 'Pixel Office'
    : route === 'watchlist'      ? 'Watchlist'
    : route === 'technical'      ? 'Technical Analysis'
    : route === 'dayreport'      ? 'Day Report'
    : (Store.classByKey(route) || {}).label;

  return (
    <div className="shell">
      <div className={'drawer-scrim' + (drawer ? ' show' : '')} onClick={() => setDrawer(false)} />
      <Nav route={route} setRoute={setRoute} totals={totals} open={drawer} onClose={() => setDrawer(false)} />
      <div className="workspace">
        {mobileMenu && <div className="tb-menu-scrim" onClick={() => setMobileMenu(false)} />}
        <div className="tb">
          <button className="icon-toggle menu" onClick={() => setDrawer(true)}><Icon name="list" size={17} /></button>
          <h2>{title}</h2>
          <div className="grow" />
          <div className={'tb-actions' + (mobileMenu ? ' open' : '')}>
            <DbStatusBadge />
            <span className="sync">
              {syncing
                ? 'Syncing…'
                : <React.Fragment>{Store.get().priceMode === 'api' ? 'Live' : 'Crypto+FX'} · <b>{window.timeAgo(Store.get().lastPriceSync)}</b></React.Fragment>}
            </span>
            <Button variant="secondary" size="sm" icon="history" onClick={refresh} disabled={syncing}>
              <span className="tb-refresh-text">{syncing ? 'Syncing' : 'Refresh'}</span>
            </Button>
            <div className="pill-toggle">
              <button className={settings.displayCcy === 'THB' ? 'on' : ''} onClick={() => Store.setSetting('displayCcy', 'THB')}>฿ THB</button>
              <button className={settings.displayCcy === 'USD' ? 'on' : ''} onClick={() => Store.setSetting('displayCcy', 'USD')}>$ USD</button>
            </div>
            <div className="group-buttons">
              <button className="icon-toggle" title={settings.hideAmounts ? 'Show amounts' : 'Hide amounts'}
              onClick={() => Store.setSetting('hideAmounts', !settings.hideAmounts)}
              style={{ color: settings.hideAmounts ? 'var(--accent)' : undefined }}>
              <Icon name={settings.hideAmounts ? 'eye-off' : 'eye'} size={16} />
            </button>
            <button className="icon-toggle" title="Export CSV" onClick={() => {
              const menu = [
                ['Holdings',      window.exportHoldingsCSV],
                ['Sell Log',      window.exportSellLogCSV],
                ['History',       window.exportSnapshotsCSV],
                ['Dividends',     window.exportDividendsCSV],
              ];
              // Simple inline picker
              const choice = window.prompt('Export CSV:\n1. Holdings\n2. Sell Log\n3. Portfolio History\n4. Dividends\n\nEnter 1-4:');
              const idx = parseInt(choice) - 1;
              if (idx >= 0 && idx < menu.length) menu[idx][1]();
            }}>
              <Icon name="download" size={16} />
            </button>
            <button className="icon-toggle" title="Backup & Restore" onClick={() => setDtOpen(true)}>
              <Icon name="archive" size={16} />
            </button>
            <button className="icon-toggle" title="Toggle theme" onClick={() => Store.setSetting('theme', settings.theme === 'light' ? 'dark' : 'light')}>
              <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} size={16} />
            </button>
            </div>
          </div>
          <button className="icon-toggle tb-more" title="Settings" onClick={() => setMobileMenu(m => !m)}>
            <Icon name="sliders" size={16} />
          </button>
        </div>
        <div className="scrollarea" key={route}>
          {route === 'dashboard'    && <Dashboard onOpenClass={setRoute} />}
          {route === 'networth'     && <NetWorthView />}
          {route === 'sectors'      && <SectorView />}
          {route === 'summary'      && <SummaryView />}
          {route === 'rebalancing'  && <RebalancingView />}
          {route === 'benchmark'    && <BenchmarkView />}
          {route === 'risk'         && <RiskView />}
          {route === 'goals'        && <GoalsView />}
          {route === 'dividends'    && <DividendCalendar />}
          {route === 'tax'          && <TaxView />}
          {route === 'planning'     && <PlanningView />}
          {route === 'alerts'       && <AlertsView />}
          {route === 'selllog'      && <SellLogView />}
          {route === 'wallet'       && <WalletOverview />}
          {route === 'transactions' && <TransactionLog />}
          {route === 'debts'        && <DebtTracker />}
          {route === 'walletsummary'  && <WalletSummary />}
          {route === 'walletcalendar' && <WalletCalendar />}
          {route === 'pixelworld'    && <PixelWorld />}
          {route === 'watchlist'     && <WatchlistView />}
          {route === 'technical'     && <TechnicalAnalysis />}
          {route === 'dayreport'     && <DayReportView />}
          {Store.classByKey(route) && <HoldingsView classKey={route} onAdd={openAdd} onEditLot={openEdit} />}
        </div>
      </div>
      <HoldingModal open={modal.open} classKey={modal.classKey} lot={modal.lot} onClose={closeModal} />
      <DataTransferModal open={dtOpen} onClose={() => setDtOpen(false)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthGate><App /></AuthGate>
);
