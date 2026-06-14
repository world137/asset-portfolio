/* store/cloud-sync.js — Async persistence: load/save portfolio & wallet, price refresh, dividends.
   Exposed as window.CloudSync.  store.js calls CloudSync.init(ctx) once to wire up shared state. */
(function () {
  let _ctx = null; // set by init()

  function makeDebounced(fn, delay) {
    let timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
      return { getTimer: () => timer, cancel: () => { clearTimeout(timer); timer = null; } };
    };
  }

  // ── Payload helpers ──────────────────────────────────────────────────────────
  function buildSavePayload() {
    const state = _ctx.getState();
    return JSON.stringify({
      holdings: state.holdings, sectors: state.sectors, fx: state.fx,
      settings: state.settings, lastPriceSync: state.lastPriceSync,
      priceMode: state.priceMode, snapshots: state.snapshots, sales: state.sales,
      tags: state.tags, holdingTags: state.holdingTags,
      holdingNotes: state.holdingNotes, goals: state.goals,
      dividends: state.dividends, targetAllocation: state.targetAllocation,
      priceAlerts: state.priceAlerts, ecoEvents: state.ecoEvents,
    });
  }

  function restoreFromSaved(saved) {
    const base   = _ctx.freshState();
    const savedFx = saved.fx || {};
    return {
      holdings: saved.holdings || base.holdings,
      sectors: { ...base.sectors, ...(saved.sectors || {}) },
      fx: {
        USDTHB: savedFx.USDTHB || base.fx.USDTHB,
        JPYTHB: savedFx.JPYTHB || base.fx.JPYTHB,
        KRWTHB: savedFx.KRWTHB || base.fx.KRWTHB,
        at: savedFx.at || null,
      },
      settings: { ...base.settings, ...(saved.settings || {}) },
      lastPriceSync: saved.lastPriceSync || null,
      priceMode: saved.priceMode || null,
      priceErrors: [],
      snapshots: (saved.snapshots || []).slice(-window.MAX_SNAPSHOTS),
      sales: saved.sales || [],
      tags: (saved.tags && saved.tags.length > 0) ? saved.tags : (window.SEED_TAGS || []),
      holdingTags: (saved.holdingTags && Object.keys(saved.holdingTags).length > 0) ? saved.holdingTags : (window.SEED_HOLDING_TAGS || {}),
      holdingNotes: saved.holdingNotes || {},
      goals: saved.goals || [],
      dividends: saved.dividends || [],
      ecoEvents: saved.ecoEvents || [],
      targetAllocation: saved.targetAllocation || {},
      priceAlerts: saved.priceAlerts || [],
      prePostPrices: {},
      dayChangePrices: {},
      peRatios: {},
    };
  }

  function restoreWalletFromSaved(saved) {
    const base      = _ctx.freshWallet();
    const savedCats = saved.categories || [];
    const categories = savedCats.length ? savedCats : base.categories;
    return {
      accounts:        saved.accounts        || [],
      categories,
      transactions:    saved.transactions    || [],
      debts:           saved.debts           || [],
      bills:           saved.bills           || [],
      savingsGoals:    saved.savingsGoals    || [],
      walletSnapshots: saved.walletSnapshots || [],
    };
  }

  // ── Portfolio save ───────────────────────────────────────────────────────────
  async function doCloudSave() {
    const { getInitialized, getInitialLoadOk, setDbStatus, notifySubs, getPortfolioId, setDbSavedAt } = _ctx;
    if (!getInitialized() || !getInitialLoadOk()) { setDbStatus('idle'); notifySubs(); return; }
    setDbStatus('saving');
    notifySubs();
    try {
      const data = buildSavePayload();
      const r    = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: getPortfolioId(), data }),
      });
      if (r.ok) {
        setDbStatus('saved');
        setDbSavedAt(Date.now());
      } else {
        setDbStatus('error');
        r.json().then(j => console.warn('[portfolio] save failed:', r.status, j?.detail || j?.error || '')).catch(() => {});
      }
    } catch (e) {
      setDbStatus('error');
      console.warn('[portfolio] save error:', e.message);
    }
    notifySubs();
  }

  // ── Wallet save ──────────────────────────────────────────────────────────────
  async function doWalletSave() {
    const { getWalletInitialized, getPortfolioId, getWallet } = _ctx;
    if (!getWalletInitialized()) return;
    try {
      await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: getPortfolioId(), data: JSON.stringify(getWallet()) }),
      });
    } catch (e) {
      console.warn('[wallet] save error:', e.message);
    }
  }

  // ── Debounced savers (unified pattern) ───────────────────────────────────────
  let _walletSavePending = false;

  const _debouncedPortfolioSave = makeDebounced(doCloudSave, 500);
  const _debouncedWalletSave    = makeDebounced(async () => { _walletSavePending = false; await doWalletSave(); }, 500);

  function scheduleCloudSave() {
    _ctx.setDbStatus('pending');
    _ctx.notifySubs();
    _debouncedPortfolioSave();
  }

  function scheduleWalletSave() {
    _walletSavePending = true;
    _debouncedWalletSave();
  }

  // ── Portfolio load ───────────────────────────────────────────────────────────
  async function loadFromCloud(overrideId) {
    const { getPortfolioId, setPortfolioId, setInitialized, setInitialLoadOk, setState, notifySubs } = _ctx;
    const id = overrideId || getPortfolioId();
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) { setInitialized(true); return false; }
    try {
      const r = await fetch('/api/portfolio?id=' + encodeURIComponent(id));
      if (!r.ok) { setInitialized(true); return false; }
      const j = await r.json();
      if (!j || !j.data) { setInitialized(true); setInitialLoadOk(true); return false; }
      const saved = JSON.parse(j.data);
      if (!saved || typeof saved !== 'object') { setInitialized(true); return false; }
      if (overrideId && overrideId !== getPortfolioId()) {
        setPortfolioId(overrideId);
      }
      const hadTags = saved.tags && saved.tags.length > 0;
      setState(restoreFromSaved(saved));
      setInitialized(true);
      setInitialLoadOk(true);
      if (!hadTags && _ctx.getState().tags.length > 0) scheduleCloudSave();
      notifySubs();
      return true;
    } catch (_) {
      setInitialized(true);
      return false;
    }
  }

  // ── Wallet load ──────────────────────────────────────────────────────────────
  async function loadWalletFromCloud() {
    const { getPortfolioId, setWalletInitialized, getWalletInitialized, setWallet, notifySubs,
            getInitialized, getInitialLoadOk, getState, netWorthSummary } = _ctx;
    const id = getPortfolioId();
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) { setWalletInitialized(true); return; }
    try {
      const r = await fetch('/api/wallet?id=' + encodeURIComponent(id));
      if (!r.ok) { console.warn('[wallet] load failed:', r.status); return; }
      const j = await r.json();
      if (j && j.data) {
        const saved = JSON.parse(j.data);
        if (saved && typeof saved === 'object') setWallet(restoreWalletFromSaved(saved));
      }
    } catch (e) {
      console.warn('[wallet] load error:', e.message);
      return;
    }
    setWalletInitialized(true);
    notifySubs();
    // Take a daily net worth snapshot after loading
    setTimeout(() => {
      if (!getInitialized() || !getInitialLoadOk()) return;
      try {
        const today  = new Date().toISOString().slice(0, 10);
        const wallet = _ctx.getWallet();
        wallet.walletSnapshots = wallet.walletSnapshots || [];
        const existing = wallet.walletSnapshots.find(s => s.date === today);
        if (!existing) {
          const nw = netWorthSummary();
          wallet.walletSnapshots.push({ date: today, netWorth: nw.netWorth, cash: nw.cashTotal, liabilities: nw.totalLiabilities });
          if (wallet.walletSnapshots.length > 365) wallet.walletSnapshots = wallet.walletSnapshots.slice(-365);
          scheduleWalletSave();
        }
      } catch (_) {}
    }, 2000);
  }

  // ── Price helpers ────────────────────────────────────────────────────────────
  function buildApiRequest() {
    const state = _ctx.getState();
    const yahoo = [], funds = [], crypto = [];
    for (const cls of window.ASSET_CLASSES) {
      if (!cls.live) continue;
      const names = [...new Set((state.holdings[cls.key] || []).map(l => l.name))];
      for (const name of names) {
        if (cls.live === 'yahoo') {
          const symbol = cls.yahooSymbol || (name + (cls.yahooSuffix || ''));
          yahoo.push({ key: cls.key, name, symbol });
        } else if (cls.live === 'settrade') {
          funds.push({ key: cls.key, name, ticker: name });
        } else if (cls.live === 'crypto') {
          const m = window.CRYPTO_MAP[name];
          if (m) crypto.push({ key: cls.key, name, id: m.id });
        }
      }
    }
    return { yahoo, funds, crypto, fx: true };
  }

  function applyPrices(map) {
    const state = _ctx.getState();
    for (const k in map) {
      const i = k.indexOf(':');
      const classKey = k.slice(0, i), name = k.slice(i + 1);
      const v = map[k];
      if (v == null || isNaN(v)) continue;
      (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +v; });
    }
  }

  async function fallbackPrices() {
    const state  = _ctx.getState();
    const errors = [];
    try {
      const ids = [...new Set(Object.values(window.CRYPTO_MAP).map(m => m.id))].join(',');
      const r   = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=thb');
      if (r.ok) {
        const j = await r.json();
        (state.holdings.crypto || []).forEach(l => {
          const m = window.CRYPTO_MAP[l.name];
          if (m && j[m.id] && j[m.id].thb) l.cur = j[m.id].thb;
        });
      }
    } catch (_) { errors.push('crypto'); }
    try {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=THB,JPY,KRW');
      if (r.ok) {
        const j = await r.json();
        if (j && j.rates && j.rates.THB) {
          const USDTHB = j.rates.THB;
          state.fx = {
            USDTHB,
            JPYTHB: j.rates.JPY ? USDTHB / j.rates.JPY : state.fx.JPYTHB,
            KRWTHB: j.rates.KRW ? USDTHB / j.rates.KRW : state.fx.KRWTHB,
            at: Date.now(),
          };
        }
      }
    } catch (_) { errors.push('fx'); }
    return { errors };
  }

  async function refreshPrices() {
    const { getState, takeSnapshot, emit } = _ctx;
    const state   = getState();
    const apiReq  = buildApiRequest();
    try {
      const r  = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiReq),
      });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.includes('application/json')) throw new Error('no-api');
      const data = await r.json();
      if (!data || typeof data.prices !== 'object') throw new Error('bad-api');
      applyPrices(data.prices);
      state.prePostPrices   = (data.prePost    && typeof data.prePost    === 'object') ? data.prePost    : {};
      state.dayChangePrices = (data.prevCloses && typeof data.prevCloses === 'object') ? data.prevCloses : {};
      state.peRatios        = (data.peRatios   && typeof data.peRatios   === 'object') ? data.peRatios   : {};
      if (data.fx && data.fx.USDTHB) {
        state.fx = {
          USDTHB: data.fx.USDTHB,
          JPYTHB: data.fx.JPYTHB || state.fx.JPYTHB || window.SEED_FX_JPYTHB,
          KRWTHB: data.fx.KRWTHB || state.fx.KRWTHB || window.SEED_FX_KRWTHB,
          at: Date.now(),
        };
      }
      state.priceMode     = 'api';
      state.priceErrors   = data.errors || [];
      state.lastPriceSync = Date.now();
      takeSnapshot();
      emit();
      return { mode: 'api', errors: data.errors || [] };
    } catch (_) {
      const res           = await fallbackPrices();
      state.priceMode     = 'fallback';
      state.lastPriceSync = Date.now();
      takeSnapshot();
      emit();
      return { mode: 'fallback', ...res };
    }
  }

  async function fetchDividends(force) {
    const { getState, emit } = _ctx;
    const state    = getState();
    const FRESH_MS = 6 * 60 * 60 * 1000;
    if (!force && state.autoDividendsAt && (Date.now() - state.autoDividendsAt < FRESH_MS)
        && (state.autoDividends || []).length) {
      return { cached: true };
    }
    const yahoo = [];
    for (const cls of window.ASSET_CLASSES) {
      if (cls.live !== 'yahoo' || cls.key === 'gold') continue;
      const names = [...new Set((state.holdings[cls.key] || []).map(l => l.name))];
      for (const name of names) {
        const symbol = cls.yahooSymbol || (name + (cls.yahooSuffix || ''));
        yahoo.push({ key: cls.key, name, symbol, ccy: cls.ccy });
      }
    }
    if (!yahoo.length) { state.autoDividends = []; state.autoDividendsAt = Date.now(); emit(); return { count: 0 }; }
    try {
      const r  = await fetch('/api/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yahoo }),
      });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.includes('application/json')) throw new Error('no-api');
      const data = await r.json();
      const list = Array.isArray(data.dividends) ? data.dividends : [];
      state.autoDividends = list.map(d => ({
        id: `auto:${d.classKey}:${d.name}:${d.exDate}`,
        classKey: d.classKey, name: d.name,
        exDate: d.exDate, payDate: d.payDate || d.exDate,
        amountPerShare: d.amountPerShare != null ? +d.amountPerShare : null,
        totalAmount: null,
        currency: d.currency || 'USD', note: '', auto: true,
      }));
      state.autoDividendsAt = Date.now();
      emit();
      return { count: state.autoDividends.length, errors: data.errors || [] };
    } catch (e) {
      return { error: e.message };
    }
  }

  // ── Data export / import ─────────────────────────────────────────────────────
  async function exportData() {
    const id = _ctx.getPortfolioId();
    const [pRes, wRes] = await Promise.all([
      fetch(`/api/portfolio?id=${encodeURIComponent(id)}`),
      fetch(`/api/wallet?id=${encodeURIComponent(id)}`),
    ]);
    if (!pRes.ok) throw new Error('export-portfolio-failed');
    if (!wRes.ok) throw new Error('export-wallet-failed');
    const pJson    = await pRes.json();
    const wJson    = await wRes.json();
    const portfolio = pJson.data ? JSON.parse(pJson.data) : null;
    const wallet    = wJson.data ? JSON.parse(wJson.data) : null;
    return { portfolio, wallet, exportedAt: new Date().toISOString(), version: 1 };
  }

  async function importData({ portfolio, wallet, mode }) {
    const r = await fetch('/api/data-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: _ctx.getPortfolioId(), mode, portfolio, wallet }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || 'import-failed');
    }
    await Promise.all([loadFromCloud(), loadWalletFromCloud()]);
    _ctx.notifySubs();
  }

  // ── beforeunload: flush both pending saves in one handler ───────────────────
  window.addEventListener('beforeunload', () => {
    if (!_ctx) return;
    const dbStatus = _ctx.getDbStatus();
    const id       = _ctx.getPortfolioId();

    // Flush portfolio save if pending
    if ((dbStatus === 'pending' || dbStatus === 'saving') && _ctx.getInitialLoadOk()) {
      try {
        const data = buildSavePayload();
        navigator.sendBeacon('/api/portfolio', new Blob([
          JSON.stringify({ id, data }),
        ], { type: 'application/json' }));
      } catch (_) {}
    }

    // Flush wallet save if pending
    if (_ctx.getWalletInitialized() && _walletSavePending) {
      try {
        navigator.sendBeacon('/api/wallet', new Blob([
          JSON.stringify({ id, data: JSON.stringify(_ctx.getWallet()) }),
        ], { type: 'application/json' }));
      } catch (_) {}
    }
  });

  // ── init ─────────────────────────────────────────────────────────────────────
  function init(ctx) {
    _ctx = ctx;
  }

  window.CloudSync = {
    init,
    scheduleCloudSave, doCloudSave,
    scheduleWalletSave, doWalletSave,
    loadFromCloud, loadWalletFromCloud,
    refreshPrices, fallbackPrices,
    fetchDividends,
    exportData, importData,
    buildSavePayload,
  };
})();
