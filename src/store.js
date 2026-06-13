/* eslint-disable */
/* ============================================================================
   store.js — Orchestrator.  Owns state/wallet, pub/sub, and the public Store API.
   Domain logic lives in src/store/ modules, wired up via init(ctx) calls below.
   ============================================================================ */
(function () {
  const USER_ID_KEY = 'portfolio.userId';
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ── Identity ─────────────────────────────────────────────────────────────────
  function getOrCreateUserId() {
    try {
      let id = localStorage.getItem(USER_ID_KEY);
      if (!id || !/^[a-zA-Z0-9_-]{6,64}$/.test(id)) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(USER_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return Math.random().toString(36).slice(2);
    }
  }
  let portfolioId = getOrCreateUserId();

  // ── Default settings ──────────────────────────────────────────────────────────
  const DEFAULT_SETTINGS = {
    displayCcy: 'THB', theme: 'light', chartStyle: 'donut',
    palette: 'class', layout: 'overview', decimals: 2, hideAmounts: false,
  };

  function freshState() {
    const holdings = {};
    for (const cls of window.ASSET_CLASSES) holdings[cls.key] = [];
    return {
      holdings,
      sectors: { ...window.SEED_SECTORS },
      fx: { USDTHB: window.SEED_FX_USDTHB, JPYTHB: window.SEED_FX_JPYTHB, KRWTHB: window.SEED_FX_KRWTHB, at: null },
      settings: { ...DEFAULT_SETTINGS },
      lastPriceSync: null, priceMode: null, priceErrors: [],
      snapshots: [], sales: [],
      tags: [], holdingTags: {}, holdingNotes: {},
      goals: [], dividends: [], ecoEvents: [],
      autoDividends: [], autoDividendsAt: null,
      targetAllocation: {}, priceAlerts: [],
      prePostPrices: {}, dayChangePrices: {}, peRatios: {},
    };
  }

  function freshWallet() {
    return {
      accounts: [],
      categories: (window.DEFAULT_WALLET_CATEGORIES || []).map(c => ({ ...c })),
      transactions: [], debts: [], bills: [], savingsGoals: [], walletSnapshots: [],
    };
  }

  let state  = freshState();
  let wallet = freshWallet();

  // ── DB sync status ────────────────────────────────────────────────────────────
  let _dbStatus      = 'idle';
  let _dbSavedAt     = null;
  let _initialized   = false;
  let _initialLoadOk = false;
  let _walletInitialized = false;

  // ── pub/sub ───────────────────────────────────────────────────────────────────
  const subs = new Set();
  function notifySubs() { subs.forEach(fn => fn()); }
  function emit() { CloudSync.scheduleCloudSave(); notifySubs(); }

  // ── Link wallet txn (shared helper used by portfolio mutations) ───────────────
  function linkWalletTxn({ accountId, assetCcy, amount, flow, fxRate, note }) {
    if (!_walletInitialized || !accountId) return;
    const acc     = wallet.accounts.find(a => a.id === accountId);
    if (!acc) return;
    const sameCcy = assetCcy === acc.currency;
    const rate    = sameCcy ? 1 : (fxRate || window.StoreCalc.defaultFxRate(assetCcy, acc.currency, state));
    wallet.transactions.push({
      id: uid(), accountId, date: new Date().toISOString().slice(0, 10),
      amount: amount * rate, flow,
      categoryId: 'cat_invest_in', note,
      toAccountId: null, fxRate: sameCcy ? null : rate,
    });
    CloudSync.scheduleWalletSave();
  }

  // ── Init all domain modules ───────────────────────────────────────────────────
  const moduleCtx = {
    // State accessors
    getState:       () => state,
    setState:       (s) => { state = s; },
    freshState,
    getWallet:      () => wallet,
    setWallet:      (w) => { wallet = w; },
    freshWallet,
    // ID
    getPortfolioId: () => portfolioId,
    setPortfolioId: (id) => {
      portfolioId = id;
      try { localStorage.setItem(USER_ID_KEY, id); } catch (_) {}
    },
    // DB status
    getDbStatus:        () => _dbStatus,
    setDbStatus:        (s) => { _dbStatus = s; },
    setDbSavedAt:       (t) => { _dbSavedAt = t; },
    getInitialized:     () => _initialized,
    setInitialized:     (v) => { _initialized = v; },
    getInitialLoadOk:   () => _initialLoadOk,
    setInitialLoadOk:   (v) => { _initialLoadOk = v; },
    getWalletInitialized: () => _walletInitialized,
    setWalletInitialized: (v) => { _walletInitialized = v; },
    // pub/sub
    notifySubs,
    emit,
    // helpers
    uid,
    linkWalletTxn,
    // schedule saves (forwarded to CloudSync after it's initialized)
    scheduleWalletSave: () => CloudSync.scheduleWalletSave(),
    // For netWorthSummary in cloud-sync wallet load callback
    netWorthSummary: () => Store.netWorthSummary(),
    // For portfolio-mutations takeSnapshot
    takeSnapshot: () => window.PortfolioMut.takeSnapshot(),
  };

  window.CloudSync.init(moduleCtx);
  window.PortfolioMut.init(moduleCtx);
  window.WalletMut.init(moduleCtx);

  // ── Public Store API ──────────────────────────────────────────────────────────
  const Store = {
    // Subscription
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get() { return state; },
    settings() { return state.settings; },
    prePostPrice(classKey, name) { return state.prePostPrices[`${classKey}:${name}`] || null; },
    getPERatio(classKey, name) { return (state.peRatios || {})[`${classKey}:${name}`] ?? null; },
    dayChangePct(classKey, name) {
      const prevClose = (state.dayChangePrices || {})[`${classKey}:${name}`];
      if (prevClose == null || prevClose === 0) return null;
      const lot = (state.holdings[classKey] || []).find(l => l.name === name);
      if (!lot || lot.cur == null) return null;
      return ((lot.cur - prevClose) / prevClose) * 100;
    },

    // Settings
    setSetting(k, v)  { state.settings[k] = v; emit(); },
    setSettings(obj)  { Object.assign(state.settings, obj); emit(); },
    resetAll()        { state = freshState(); emit(); },

    // Derived data (delegated to StoreCalc, passing state by reference)
    positions:        (classKey) => window.StoreCalc.positions(classKey, state),
    classTotals:      (classKey) => window.StoreCalc.classTotals(classKey, state),
    grandTotals:      ()         => window.StoreCalc.grandTotals(state),
    sectorTotals:     ()         => window.StoreCalc.sectorTotals(state),
    tagTotals:        ()         => window.StoreCalc.tagTotals(state),
    classByKey:       (k)        => window.StoreCalc.classByKey(k),
    lotMetrics:       (lot)      => window.StoreCalc.lotMetrics(lot),
    toDisplay:        (amt, ccy) => window.StoreCalc.toDisplay(amt, ccy, state),
    walletToDisplay:  (amt, ccy) => window.StoreCalc.walletToDisplay(amt, ccy, state),
    defaultFxRate:    (f, t)     => window.StoreCalc.defaultFxRate(f, t, state),
    salesSummary:     ()         => window.StoreCalc.salesSummary(state),
    monthlyFlow:      (y, m)     => window.StoreCalc.monthlyFlow(y, m, wallet, state),
    debtSummary:      ()         => window.StoreCalc.debtSummary(wallet, state),
    netWorthSummary:  ()         => window.StoreCalc.netWorthSummary(state, wallet),
    walletMonthlyData:(n)        => window.StoreCalc.walletMonthlyData(n, wallet, state),
    walletCategoryData:(p)       => window.StoreCalc.walletCategoryData(p, wallet, state),
    accountBalance:   (id)       => window.StoreCalc.accBal(id, wallet),

    // Snapshots
    getSnapshots: () => state.snapshots,
    autoSnapshot() { window.PortfolioMut.takeSnapshot(); emit(); },

    // Holdings mutations (delegated to PortfolioMut)
    addLot:              (...a) => window.PortfolioMut.addLot(...a),
    updateLot:           (...a) => window.PortfolioMut.updateLot(...a),
    deleteLot:           (...a) => window.PortfolioMut.deleteLot(...a),
    applyParValueReduction: (...a) => window.PortfolioMut.applyParValueReduction(...a),
    setCurrentPrice:     (...a) => window.PortfolioMut.setCurrentPrice(...a),
    setSector:           (...a) => window.PortfolioMut.setSector(...a),

    // Sales
    recordSale:  (...a) => window.PortfolioMut.recordSale(...a),
    deleteSale:  (...a) => window.PortfolioMut.deleteSale(...a),
    getSales:    ()     => state.sales || [],

    // Tags
    addTag:         (...a) => window.PortfolioMut.addTag(...a),
    deleteTag:      (...a) => window.PortfolioMut.deleteTag(...a),
    updateTag:      (...a) => window.PortfolioMut.updateTag(...a),
    setHoldingTags: (...a) => window.PortfolioMut.setHoldingTags(...a),
    getTags:        ()     => state.tags || [],
    getHoldingTags: (key)  => (state.holdingTags || {})[key] || [],

    // Goals
    addGoal:    (...a) => window.PortfolioMut.addGoal(...a),
    updateGoal: (...a) => window.PortfolioMut.updateGoal(...a),
    deleteGoal: (...a) => window.PortfolioMut.deleteGoal(...a),
    getGoals:   ()     => state.goals || [],

    // Dividends
    addDividend:    (...a) => window.PortfolioMut.addDividend(...a),
    updateDividend: (...a) => window.PortfolioMut.updateDividend(...a),
    deleteDividend: (...a) => window.PortfolioMut.deleteDividend(...a),
    getDividends:   ()     => state.dividends || [],

    // Auto dividends
    getAutoDividends:     () => state.autoDividends || [],
    getDividendFetchedAt: () => state.autoDividendsAt,
    fetchDividends:       (force) => window.CloudSync.fetchDividends(force),

    // Eco events
    getEcoEvents:    ()     => state.ecoEvents || [],
    addEcoEvent:     (...a) => window.PortfolioMut.addEcoEvent(...a),
    updateEcoEvent:  (...a) => window.PortfolioMut.updateEcoEvent(...a),
    deleteEcoEvent:  (...a) => window.PortfolioMut.deleteEcoEvent(...a),

    // Price alerts
    addPriceAlert:      (...a) => window.PortfolioMut.addPriceAlert(...a),
    deletePriceAlert:   (...a) => window.PortfolioMut.deletePriceAlert(...a),
    getPriceAlerts:     ()     => state.priceAlerts || [],
    markAlertTriggered: (...a) => window.PortfolioMut.markAlertTriggered(...a),

    // Holding notes
    setHoldingNote:  (...a) => window.PortfolioMut.setHoldingNote(...a),
    getHoldingNote:  (cls, name) => (state.holdingNotes || {})[cls + ':' + name] || '',
    getHoldingNotes: ()     => state.holdingNotes || {},

    // Target allocation
    setTargetAllocation: (...a) => window.PortfolioMut.setTargetAllocation(...a),
    getTargetAllocation: ()     => state.targetAllocation || {},

    // Wallet read helpers
    getWallet:       () => wallet,
    getWalletSnapshots: () => wallet.walletSnapshots || [],

    // Wallet mutations (delegated to WalletMut)
    addAccount:    (...a) => window.WalletMut.addAccount(...a),
    updateAccount: (...a) => window.WalletMut.updateAccount(...a),
    deleteAccount: (...a) => window.WalletMut.deleteAccount(...a),

    addCategory:    (...a) => window.WalletMut.addCategory(...a),
    updateCategory: (...a) => window.WalletMut.updateCategory(...a),
    deleteCategory: (...a) => window.WalletMut.deleteCategory(...a),

    addTransaction:    (...a) => window.WalletMut.addTransaction(...a),
    updateTransaction: (...a) => window.WalletMut.updateTransaction(...a),
    deleteTransaction: (...a) => window.WalletMut.deleteTransaction(...a),

    addDebt:             (...a) => window.WalletMut.addDebt(...a),
    updateDebt:          (...a) => window.WalletMut.updateDebt(...a),
    settleDebt:          (...a) => window.WalletMut.settleDebt(...a),
    deleteDebt:          (...a) => window.WalletMut.deleteDebt(...a),
    payInstallmentMonth: (...a) => window.WalletMut.payInstallmentMonth(...a),

    addBill:    (...a) => window.WalletMut.addBill(...a),
    updateBill: (...a) => window.WalletMut.updateBill(...a),
    deleteBill: (...a) => window.WalletMut.deleteBill(...a),

    addSavingsGoal:    (...a) => window.WalletMut.addSavingsGoal(...a),
    updateSavingsGoal: (...a) => window.WalletMut.updateSavingsGoal(...a),
    deleteSavingsGoal: (...a) => window.WalletMut.deleteSavingsGoal(...a),

    takeWalletSnapshot: () => window.WalletMut.takeWalletSnapshot(() => Store.netWorthSummary()),
    getBillsDueSoon:    (...a) => window.WalletMut.getBillsDueSoon(...a),

    // Cloud sync
    loadFromCloud:  (id) => window.CloudSync.loadFromCloud(id),
    setPortfolioId: (id) => window.CloudSync.loadFromCloud(id),
    loadWalletFromCloud: () => window.CloudSync.loadWalletFromCloud(),
    getPortfolioId: () => portfolioId,
    setPrimaryId(newId) {
      if (!newId || !/^[a-zA-Z0-9_-]{6,64}$/.test(newId)) return;
      portfolioId = newId;
      try { localStorage.setItem(USER_ID_KEY, newId); } catch (_) {}
    },
    getDbStatus: () => ({ status: _dbStatus, savedAt: _dbSavedAt }),
    forceSave:   () => window.CloudSync.doCloudSave(),

    // Prices
    refreshPrices: () => window.CloudSync.refreshPrices(),

    // Data export / import
    exportData: () => window.CloudSync.exportData(),
    importData: (opts) => window.CloudSync.importData(opts),
  };

  window.Store = Store;
})();
