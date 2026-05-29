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
      {key !== 'dashboard' && <span className="val">{sym}{window.fmtBig((totals.classes.find(c => c.key === key) || {}).value || 0)}</span>}
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
      </div>
      <div className="foot">
        <span className="av">PT</span>
        <div>
          <div className="who">My Portfolio</div>
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
  React.useEffect(() => { Store.loadFromCloud(); }, []);

  const openAdd = (classKey) => setModal({ open: true, classKey, lot: null });
  const openEdit = (lot) => setModal({ open: true, classKey: route, lot });

  const refresh = async () => {
    setSyncing(true);
    await Store.refreshPrices();
    setSyncing(false);
  };

  const title = route === 'dashboard' ? 'Dashboard' : route === 'sectors' ? 'Analysis' : (Store.classByKey(route) || {}).label;

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
          {Store.classByKey(route) && <HoldingsView classKey={route} onAdd={openAdd} onEditLot={openEdit} />}
        </div>
      </div>
      <HoldingModal open={modal.open} classKey={modal.classKey} lot={modal.lot} onClose={() => setModal({ open: false, classKey: null, lot: null })} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
