/* eslint-disable */
/* app.jsx — shell: navigation, routing, toolbar, settings */

// ── Navigation sidebar ────────────────────────────────────────────────────────
function Nav({ route, setRoute, totals, open, onClose }) {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  const NO_VAL_ROUTES = new Set(['dashboard','summary','networth','wallet','transactions','debts','walletsummary','walletcalendar','bills','savingsgoals','reconcile','pixelworld','watchlist','sectors','selllog','technical','dayreport','rebalancing','dividends','goals','benchmark','risk','alerts','planning','analysis']);

  const billsDue = Store.getBillsDueSoon ? Store.getBillsDueSoon(3) : [];

  const item = (key, label, icon, color) => (
    <div key={key} className={'item' + (route === key ? ' active' : '')} onClick={() => { setRoute(key); onClose(); }}>
      {color ? <span className="dot" style={{ background: color }} /> : <span className="ic"><Icon name={icon} size={16} /></span>}
      <span>{label}</span>
      {key === 'wallet' && billsDue.length > 0 && (
        <span style={{ marginLeft: 4, background: '#f59e0b', color: '#fff', borderRadius: 10,
                       padding: '1px 6px', fontSize: 10, fontWeight: 700, lineHeight: 1.6 }}>
          {billsDue.length}
        </span>
      )}
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
        {item('analysis',   'Analysis Hub', 'layers')}
        {item('dividends',  'Portfolio Cal', 'calendar')}
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
        {item('bills',          'Bills',        'bell')}
        {item('savingsgoals',   'Savings Goals','target')}
        {item('reconcile',      'Reconcile',    'check-square')}
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

// SummaryView, PortfolioGrowthPanel, SectorDrillModal, SectorView live in src/views/SummaryView.jsx

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

// ── Wallet layout: wraps all wallet views with a floating Quick Add button ─────
function WalletLayout({ children }) {
  const wallet   = Store.getWallet();
  const [open, setOpen] = React.useState(false);

  const accounts    = wallet.accounts.filter(a => !a.archived);
  const lastUsedAcc = React.useMemo(() => {
    const txns = [...wallet.transactions].sort((a, b) => b.date.localeCompare(a.date));
    for (const t of txns) {
      const a = accounts.find(a => a.id === t.accountId);
      if (a) return a;
    }
    return accounts[0] || null;
  }, [wallet.transactions, wallet.accounts]);

  return (
    <div style={{ position: 'relative' }}>
      {children}
      <button
        onClick={() => setOpen(true)}
        title="Quick add transaction"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 90,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 26, fontWeight: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.22)', transition: 'transform .12s, box-shadow .12s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.09)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        +
      </button>
      <TransactionModal open={open} transaction={null}
                        defaultAccountId={lastUsedAcc ? lastUsedAcc.id : undefined}
                        onClose={() => setOpen(false)} />
    </div>
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
    : route === 'analysis'       ? 'Portfolio Analysis'
    : route === 'rebalancing'    ? 'Portfolio Analysis'
    : route === 'benchmark'      ? 'Portfolio Analysis'
    : route === 'risk'           ? 'Portfolio Analysis'
    : route === 'goals'          ? 'Portfolio Analysis'
    : route === 'dividends'      ? 'Portfolio Calendar'
    : route === 'planning'       ? 'Portfolio Analysis'
    : route === 'alerts'         ? 'Price Alerts'
    : route === 'selllog'        ? 'Sell Log'
    : route === 'wallet'         ? 'Accounts'
    : route === 'transactions'   ? 'Transactions'
    : route === 'debts'          ? 'Debts'
    : route === 'walletsummary'  ? 'Wallet Summary'
    : route === 'walletcalendar' ? 'Calendar'
    : route === 'bills'          ? 'Bills & Reminders'
    : route === 'savingsgoals'   ? 'Savings Goals'
    : route === 'reconcile'      ? 'Reconcile'
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
          {route === 'analysis'     && <PortfolioAnalysisView />}
          {route === 'rebalancing'  && <PortfolioAnalysisView defaultTab="rebalancing" />}
          {route === 'benchmark'    && <PortfolioAnalysisView defaultTab="benchmark" />}
          {route === 'risk'         && <PortfolioAnalysisView defaultTab="risk" />}
          {route === 'goals'        && <PortfolioAnalysisView defaultTab="goals" />}
          {route === 'planning'     && <PortfolioAnalysisView defaultTab="planning" />}
          {route === 'dividends'    && <DividendCalendar />}
          {route === 'alerts'       && <AlertsView />}
          {route === 'selllog'      && <SellLogView />}
          {['wallet','transactions','debts','walletsummary','walletcalendar','bills','savingsgoals','reconcile'].includes(route) && (
            <WalletLayout>
              {route === 'wallet'         && <WalletOverview />}
              {route === 'transactions'   && <TransactionLog />}
              {route === 'debts'          && <DebtTracker />}
              {route === 'walletsummary'  && <WalletSummary />}
              {route === 'walletcalendar' && <WalletCalendar />}
              {route === 'bills'          && <BillsView />}
              {route === 'savingsgoals'   && <SavingsGoalsView />}
              {route === 'reconcile'      && <ReconcileView />}
            </WalletLayout>
          )}
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
