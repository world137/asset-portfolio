/* eslint-disable */
/* app.jsx — shell, navigation, settings, routing */

function useStore() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => Store.subscribe(force), []);
  return Store;
}

function Nav({ route, setRoute, totals, open, onClose }) {
  const settings = Store.settings();
  const sym = window.ccySymbol(settings.displayCcy);
  const item = (key, label, icon, color) => (
    <div key={key} className={'item' + (route === key ? ' active' : '')} onClick={() => { setRoute(key); onClose(); }}>
      {color ? <span className="dot" style={{ background: color }} /> : <span className="ic"><Icon name={icon} size={16} /></span>}
      <span>{label}</span>
      {key !== 'dashboard' && key !== 'summary' && <span className="val">{sym}{window.fmtBig((totals.classes.find(c => c.key === key) || {}).value || 0)}</span>}
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
        {item('dashboard', 'Dashboard', 'layers')}
        <div className="grp-h">Holdings</div>
        {window.ASSET_CLASSES.map(c => item(c.key, c.label, null, window.CLASS_COLORS[c.key]))}
        <div className="grp-h">Analysis</div>
        {item('sectors', 'By Sector', 'sliders')}
        {item('summary', 'Cost vs Price', 'list')}
      </div>
      <div className="foot">
        <span className="av">PT</span>
        <div>
          <div className="who" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>My Portfolio
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

function SummaryView() {
  const settings = Store.settings();
  const disp = settings.displayCcy;
  const sym = window.ccySymbol(disp);
  const totals = Store.grandTotals();
  const [sortBy, setSortBy] = React.useState('value');
  const [sortDir, setSortDir] = React.useState(-1);
  const [filterClass, setFilterClass] = React.useState('all');

  const rows = [];
  for (const cls of window.ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      const value = Store.toDisplay(p.value, cls.ccy);
      const cost  = Store.toDisplay(p.cost,  cls.ccy);
      const curDisp = disp === 'USD' && cls.ccy === 'THB'
        ? p.cur / (Store.get().fx.USDTHB || window.SEED_FX_USDTHB)
        : disp === 'THB' && cls.ccy === 'USD'
        ? p.cur * (Store.get().fx.USDTHB || window.SEED_FX_USDTHB)
        : p.cur;
      const avgDisp = disp === 'USD' && cls.ccy === 'THB'
        ? p.avgPrice / (Store.get().fx.USDTHB || window.SEED_FX_USDTHB)
        : disp === 'THB' && cls.ccy === 'USD'
        ? p.avgPrice * (Store.get().fx.USDTHB || window.SEED_FX_USDTHB)
        : p.avgPrice;
      rows.push({
        classKey: cls.key, classLabel: cls.label, classColor: window.CLASS_COLORS[cls.key],
        name: p.name, sector: p.sector, ccy: cls.ccy,
        qty: p.qty, avgPrice: p.avgPrice, avgPriceDisp: avgDisp, cur: p.cur, curDisp: curDisp,
        cost, value, profit: value - cost,
        pct: cost ? ((value - cost) / cost) * 100 : 0,
        priceChg: p.avgPrice ? ((p.cur - p.avgPrice) / p.avgPrice) * 100 : 0,
      });
    }
  }

  const filtered = filterClass === 'all' ? rows : rows.filter(r => r.classKey === filterClass);
  const sorted = [...filtered].sort((a, b) => sortDir * (b[sortBy] - a[sortBy]));

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => -d);
    else { setSortBy(col); setSortDir(-1); }
  };
  const SortTh = ({ col, label, right }) => (
    <th className={right ? 'num' : ''} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        onClick={() => handleSort(col)}>
      {label}{sortBy === col ? (sortDir < 0 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  const filtTotals = sorted.reduce((a, r) => ({ cost: a.cost + r.cost, value: a.value + r.value, profit: a.profit + r.profit }), { cost: 0, value: 0, profit: 0 });
  const filtPct = filtTotals.cost ? (filtTotals.profit / filtTotals.cost) * 100 : 0;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Cost &amp; Price Summary</h1>
          <div className="t-small">{rows.length} positions across all asset classes · valued in {disp}</div>
        </div>
        <div className="layoutseg">
          <button className={filterClass === 'all' ? 'on' : ''} onClick={() => setFilterClass('all')}>All</button>
          {window.ASSET_CLASSES.map(c => (
            <button key={c.key} className={filterClass === c.key ? 'on' : ''} onClick={() => setFilterClass(c.key)}>{c.short}</button>
          ))}
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
                  <div className="big" style={{ fontSize: 20 }}>{best.name.replace(/THB$/,'')}</div>
                  <div className="delta up">{window.fmtPct(best.pct)}</div>
                </React.Fragment>
              : <div className="big">—</div>;
          })()}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div><div className="t">All Positions</div><div className="s">Click column headers to sort</div></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ptable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Ticker / Name</th>
                <th>Sector / Type</th>
                <SortTh col="qty" label="Units" right />
                <SortTh col="avgPriceDisp" label="Avg Cost" right />
                <SortTh col="curDisp" label="Current" right />
                <th className="num" style={{ width: 120 }}>Cost vs Price</th>
                <SortTh col="cost" label="Total Cost" right />
                <SortTh col="value" label="Value" right />
                <SortTh col="profit" label="P/L" right />
                <SortTh col="pct" label="%" right />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={11}><div className="empty">No holdings found.</div></td></tr>
              )}
              {sorted.map((r, i) => {
                const barMax = Math.max(r.cost, r.value) || 1;
                const costW  = (r.cost  / barMax) * 100;
                const valW   = (r.value / barMax) * 100;
                const isUp   = r.profit >= 0;
                return (
                  <tr key={r.classKey + ':' + r.name + ':' + i} className="pos" style={{ cursor: 'default' }}>
                    <td>
                      <span className="tk">
                        <span className="av" style={{ background: r.classColor, borderRadius: 7 }}>{r.classLabel.slice(0,2).toUpperCase()}</span>
                        <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{r.classLabel}</span>
                      </span>
                    </td>
                    <td><span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--fg-1)' }}>{r.name.replace(/THB$/,'')}</span></td>
                    <td><span className="sectorchip" style={{ cursor: 'default' }}>{r.sector}</span></td>
                    <td className="num">{window.fmtQty(r.qty)}</td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>
                      {sym}{window.fmtBig(r.avgPriceDisp)}
                    </td>
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
                        <div className="costbar" title={`Cost: ${sym}${window.fmtBig(r.cost)}`} style={{ width: costW + '%', background: 'var(--fg-4)' }} />
                        <div className="costbar" title={`Value: ${sym}${window.fmtBig(r.value)}`} style={{ width: valW + '%', background: isUp ? 'var(--green-600)' : 'var(--red-600)', opacity: 0.7 }} />
                      </div>
                    </td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(r.cost)}</td>
                    <td className="num">{sym}{window.fmtBig(r.value)}</td>
                    <td className={'num ' + (r.profit >= 0 ? 'up' : 'down')}>
                      {(r.profit >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(r.profit))}
                    </td>
                    <td className={'num ' + (r.pct >= 0 ? 'up' : 'down')}>{window.fmtPct(r.pct)}</td>
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

function SectorView({ onOpenClass }) {
  const settings = Store.settings();
  const secs = Store.sectorTotals();
  const total = secs.reduce((a, s) => a + s.value, 0) || 1;
  const palette = ['#9a6b1f', '#2962ab', '#1f7a4d', '#b6862f', '#3b8bd0', '#c79a3a', '#8a6310', '#5a6677', '#b43a3a', '#2c3a52', '#7a5012', '#1f4a85'];
  const segs = secs.map((s, i) => ({ label: s.sector, value: s.value, color: palette[i % palette.length] }));
  const [hot, setHot] = React.useState(null);
  const sym = window.ccySymbol(settings.displayCcy);
  return (
    <div className="page">
      <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Allocation by Sector</h1>
      <div className="t-small" style={{ marginBottom: 20 }}>Across every asset class, valued in {settings.displayCcy}. Edit a holding's sector from its class page.</div>
      <div className="dash dash-2col">
        <div className="card"><div className="card-h"><div className="t">Sector Mix</div></div>
          <div className="card-b">
            <div className="chartwrap">
              <Donut segments={segs} size={196} style={settings.chartStyle} hot={hot} onHover={setHot}
                     center={<React.Fragment><div className="c-lab">Sectors</div><div className="c-val">{secs.length}</div></React.Fragment>} />
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
        <div className="card"><div className="card-h"><div className="t">Sector Breakdown</div></div>
          <table className="ptable">
            <thead><tr><th>Sector</th><th style={{ width: 160 }}>Weight</th><th className="num">Value</th></tr></thead>
            <tbody>
              {segs.map((s, i) => (
                <tr key={s.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                  <td><span className="tk"><span className="d" style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />{s.label}</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="minibar" style={{ flex: 1 }}><span style={{ width: ((s.value / total) * 100) + '%', background: s.color }} /></div><span style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--fg-3)', minWidth: 38, textAlign: 'right' }}>{((s.value / total) * 100).toFixed(1)}%</span></div></td>
                  <td className="num">{sym}{window.fmtBig(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function App() {
  useStore();
  const settings = Store.settings();
  const totals = Store.grandTotals();
  const [route, setRoute] = React.useState('dashboard');
  const [drawer, setDrawer] = React.useState(false);
  const [modal, setModal] = React.useState({ open: false, classKey: null, lot: null });
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => { document.documentElement.setAttribute('data-theme', settings.theme); }, [settings.theme]);
  // Load cloud state on mount; falls back silently to localStorage if KV is unavailable.
  React.useEffect(() => { Store.loadFromCloud().then(() => Store.autoSnapshot()); }, []);

  // Auto-refresh prices every 12 hours; also refresh immediately on mount if stale.
  const TWELVE_HR = 12 * 60 * 60 * 1000;
  React.useEffect(() => {
    const maybeRefresh = () => {
      const last = Store.get().lastPriceSync;
      if (!last || Date.now() - last >= TWELVE_HR) refresh();
    };
    maybeRefresh();
    const timer = setInterval(refresh, TWELVE_HR);
    return () => clearInterval(timer);
  }, []);

  const openAdd = (classKey) => setModal({ open: true, classKey, lot: null });
  const openEdit = (lot) => setModal({ open: true, classKey: route, lot });

  const refresh = async () => {
    setSyncing(true);
    await Store.refreshPrices();
    setSyncing(false);
  };

  const title = route === 'dashboard' ? 'Dashboard' : route === 'sectors' ? 'Analysis' : route === 'summary' ? 'Cost & Price Summary' : (Store.classByKey(route) || {}).label;

  return (
    <div className="shell">
      <div className={'drawer-scrim' + (drawer ? ' show' : '')} onClick={() => setDrawer(false)} />
      <Nav route={route} setRoute={setRoute} totals={totals} open={drawer} onClose={() => setDrawer(false)} />
      <div className="workspace">
        <div className="tb">
          <button className="icon-toggle menu" onClick={() => setDrawer(true)}><Icon name="list" size={17} /></button>
          <h2>{title}</h2>
          <div className="grow" />
          <span className="sync">{syncing ? 'Syncing…' : <React.Fragment>{Store.get().priceMode === 'api' ? 'Live' : 'Crypto+FX'} · <b>{window.timeAgo(Store.get().lastPriceSync)}</b></React.Fragment>}</span>
          <Button variant="secondary" size="sm" icon="history" onClick={refresh} disabled={syncing}>{syncing ? 'Syncing' : 'Refresh'}</Button>
          <div className="pill-toggle">
            <button className={settings.displayCcy === 'THB' ? 'on' : ''} onClick={() => Store.setSetting('displayCcy', 'THB')}>฿ THB</button>
            <button className={settings.displayCcy === 'USD' ? 'on' : ''} onClick={() => Store.setSetting('displayCcy', 'USD')}>$ USD</button>
          </div>
          <button className="icon-toggle" title="Toggle theme" onClick={() => Store.setSetting('theme', settings.theme === 'light' ? 'dark' : 'light')}>
            <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} size={16} />
          </button>
        </div>
        <div className="scrollarea" key={route}>
          {route === 'dashboard' && <Dashboard onOpenClass={setRoute} />}
          {route === 'sectors' && <SectorView onOpenClass={setRoute} />}
          {route === 'summary' && <SummaryView />}
          {Store.classByKey(route) && <HoldingsView classKey={route} onAdd={openAdd} onEditLot={openEdit} />}
        </div>
      </div>
      <HoldingModal open={modal.open} classKey={modal.classKey} lot={modal.lot} onClose={() => setModal({ open: false, classKey: null, lot: null })} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthGate><App /></AuthGate>
);
