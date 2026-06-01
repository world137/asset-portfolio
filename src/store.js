/* eslint-disable */
/* ============================================================================
   store.js — App state, persistence, calculations, live prices.

   Plain JS singleton with a tiny pub/sub. UI subscribes via Store.subscribe().

   DATA SOURCE: Supabase only (via /api/portfolio).
   portfolioId lives in localStorage as an identity token only — no portfolio
   data is ever read from or written to localStorage.
   ============================================================================ */
(function () {
  const USER_ID_KEY = 'portfolio.userId';
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ── Identity ───────────────────────────────────────────────────────────────
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

  // ── Default settings ───────────────────────────────────────────────────────
  const DEFAULT_SETTINGS = {
    displayCcy: 'THB',
    theme: 'light',
    chartStyle: 'donut',
    palette: 'class',
    layout: 'overview',
    decimals: 2,
    hideAmounts: false,
  };

  function freshState() {
    const holdings = {};
    for (const cls of window.ASSET_CLASSES) holdings[cls.key] = [];
    return {
      holdings,
      sectors: { ...window.SEED_SECTORS },
      fx: { USDTHB: window.SEED_FX_USDTHB, JPYTHB: window.SEED_FX_JPYTHB, KRWTHB: window.SEED_FX_KRWTHB, at: null },
      settings: { ...DEFAULT_SETTINGS },
      lastPriceSync: null,
      priceMode: null,
      priceErrors: [],
      snapshots: [],
      sales: [],
      tags: [],        // [{ id, name, color }]
      holdingTags: {}, // { "classKey:name": [tagId, ...] }
      prePostPrices: {}, // { "classKey:name": { price, pct, type: 'pre'|'post' } } — not persisted
    };
  }

  function freshWallet() {
    return {
      accounts: [],
      categories: (window.DEFAULT_WALLET_CATEGORIES || []).map(c => ({ ...c })),
      transactions: [],
      debts: [],
    };
  }

  let state  = freshState();
  let wallet = freshWallet();

  // ── DB sync status ─────────────────────────────────────────────────────────
  let _dbStatus = 'idle'; // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  let _dbSavedAt = null;
  // Guard: never write before loadFromCloud has run at least once.
  let _initialized = false;

  // ── Wallet sync state ──────────────────────────────────────────────────────
  let _walletInitialized = false;
  let _walletSaveTimer   = null;

  // ── pub/sub ────────────────────────────────────────────────────────────────
  const subs = new Set();
  function emit() { scheduleCloudSave(); subs.forEach(fn => fn()); }

  // ── Supabase sync ──────────────────────────────────────────────────────────
  let _saveTimer = null;

  function buildSavePayload() {
    return JSON.stringify({
      holdings: state.holdings, sectors: state.sectors, fx: state.fx,
      settings: state.settings, lastPriceSync: state.lastPriceSync,
      priceMode: state.priceMode, snapshots: state.snapshots, sales: state.sales,
      tags: state.tags, holdingTags: state.holdingTags,
    });
  }

  function restoreWalletFromSaved(saved) {
    const base = freshWallet();
    const savedCats = saved.categories || [];
    // Merge: keep saved categories; if none, fall back to defaults
    const categories = savedCats.length ? savedCats : base.categories;
    return {
      accounts:     saved.accounts     || [],
      categories,
      transactions: saved.transactions || [],
      debts:        saved.debts        || [],
    };
  }

  function restoreFromSaved(saved) {
    const base = freshState();
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
      tags: saved.tags || [],
      holdingTags: saved.holdingTags || {},
    };
  }

  function scheduleCloudSave() {
    clearTimeout(_saveTimer);
    _dbStatus = 'pending';
    subs.forEach(fn => fn());
    _saveTimer = setTimeout(doCloudSave, 500);
  }

  async function doCloudSave() {
    if (!_initialized) { _dbStatus = 'idle'; subs.forEach(fn => fn()); return; }
    _dbStatus = 'saving';
    subs.forEach(fn => fn());
    try {
      const data = buildSavePayload();
      const r = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: portfolioId, data }),
      });
      if (r.ok) {
        _dbStatus = 'saved';
        _dbSavedAt = Date.now();
      } else {
        _dbStatus = 'error';
        r.json().then(j => console.warn('[portfolio] save failed:', r.status, j?.detail || j?.error || '')).catch(() => {});
      }
    } catch (e) {
      _dbStatus = 'error';
      console.warn('[portfolio] save error:', e.message);
    }
    subs.forEach(fn => fn());
  }

  // Flush any pending save when the tab closes.
  window.addEventListener('beforeunload', () => {
    if (_dbStatus !== 'pending' && _dbStatus !== 'saving') return;
    clearTimeout(_saveTimer);
    try {
      const data = buildSavePayload();
      navigator.sendBeacon('/api/portfolio', new Blob([
        JSON.stringify({ id: portfolioId, data }),
      ], { type: 'application/json' }));
    } catch (_) {}
  });

  async function loadFromCloud(overrideId) {
    const id = overrideId || portfolioId;
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) { _initialized = true; return false; }
    try {
      const r = await fetch('/api/portfolio?id=' + encodeURIComponent(id));
      if (!r.ok) { _initialized = true; return false; }
      const j = await r.json();
      if (!j || !j.data) { _initialized = true; return false; }
      const saved = JSON.parse(j.data);
      if (!saved || typeof saved !== 'object') { _initialized = true; return false; }
      if (overrideId && overrideId !== portfolioId) {
        portfolioId = overrideId;
        try { localStorage.setItem(USER_ID_KEY, overrideId); } catch (_) {}
      }
      state = restoreFromSaved(saved);
      _initialized = true;
      subs.forEach(fn => fn());
      return true;
    } catch (_) {
      _initialized = true;
      return false;
    }
  }

  // ── Wallet cloud save/load ─────────────────────────────────────────────────
  function scheduleWalletSave() {
    clearTimeout(_walletSaveTimer);
    _walletSaveTimer = setTimeout(doWalletSave, 500);
  }

  async function doWalletSave() {
    if (!_walletInitialized) return;
    try {
      await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: portfolioId, data: JSON.stringify(wallet) }),
      });
    } catch (e) {
      console.warn('[wallet] save error:', e.message);
    }
  }

  async function loadWalletFromCloud() {
    const id = portfolioId;
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) { _walletInitialized = true; return; }
    try {
      const r = await fetch('/api/wallet?id=' + encodeURIComponent(id));
      if (!r.ok) { _walletInitialized = true; return; }
      const j = await r.json();
      if (j && j.data) {
        const saved = JSON.parse(j.data);
        if (saved && typeof saved === 'object') {
          wallet = restoreWalletFromSaved(saved);
        }
      }
    } catch (_) {}
    _walletInitialized = true;
    subs.forEach(fn => fn());
  }

  // Flush pending wallet save on tab close.
  window.addEventListener('beforeunload', () => {
    if (!_walletInitialized) return;
    try {
      navigator.sendBeacon('/api/wallet', new Blob([
        JSON.stringify({ id: portfolioId, data: JSON.stringify(wallet) }),
      ], { type: 'application/json' }));
    } catch (_) {}
  });

  // ── Currency conversion ────────────────────────────────────────────────────
  function toDisplay(amount, nativeCcy) {
    const disp = state.settings.displayCcy;
    if (nativeCcy === disp) return amount;
    const USDTHB = state.fx.USDTHB || window.SEED_FX_USDTHB;
    if (nativeCcy === 'USD' && disp === 'THB') return amount * USDTHB;
    if (nativeCcy === 'THB' && disp === 'USD') return amount / USDTHB;
    return amount;
  }

  // Convert any wallet currency to the display currency (THB or USD).
  function walletToDisplay(amount, nativeCcy) {
    const disp   = state.settings.displayCcy;
    if (nativeCcy === disp) return amount;
    const USDTHB = state.fx.USDTHB || window.SEED_FX_USDTHB;
    const JPYTHB = state.fx.JPYTHB || window.SEED_FX_JPYTHB;
    const KRWTHB = state.fx.KRWTHB || window.SEED_FX_KRWTHB;
    // Convert to THB first
    let inTHB;
    if      (nativeCcy === 'THB') inTHB = amount;
    else if (nativeCcy === 'USD') inTHB = amount * USDTHB;
    else if (nativeCcy === 'JPY') inTHB = amount * JPYTHB;
    else if (nativeCcy === 'KRW') inTHB = amount * KRWTHB;
    else                          inTHB = amount;
    // Convert from THB to display currency
    if (disp === 'THB') return inTHB;
    if (disp === 'USD') return inTHB / USDTHB;
    return inTHB;
  }

  // ── Lot calculations ───────────────────────────────────────────────────────
  function lotMetrics(lot) {
    const cost   = lot.price * lot.qty;
    const value  = (lot.cur != null ? lot.cur : lot.price) * lot.qty;
    const profit = value - cost;
    const pct    = cost ? (profit / cost) * 100 : 0;
    return { cost, value, profit, pct };
  }

  // ── Aggregated positions per class ─────────────────────────────────────────
  function positions(classKey) {
    const cls = classByKey(classKey);
    const lots = state.holdings[classKey] || [];
    const map = new Map();
    for (const lot of lots) {
      if (!map.has(lot.name)) {
        map.set(lot.name, { name: lot.name, type: lot.type || null, ccy: cls.ccy, qty: 0, cost: 0, value: 0, lots: [], cur: lot.cur });
      }
      const m = lotMetrics(lot);
      const p = map.get(lot.name);
      p.qty += lot.qty; p.cost += m.cost; p.value += m.value;
      p.cur = lot.cur; p.lots.push({ ...lot, ...m });
    }
    const out = [];
    for (const p of map.values()) {
      p.avgPrice = p.qty ? p.cost / p.qty : 0;
      p.profit   = p.value - p.cost;
      p.pct      = p.cost ? (p.profit / p.cost) * 100 : 0;
      p.sector   = classKey === 'crypto' ? 'Crypto' : (state.sectors[classKey + ':' + p.name] || (p.type || '—'));
      p.classKey = classKey;
      out.push(p);
    }
    out.sort((a, b) => b.value - a.value);
    return out;
  }

  // ── Class-level totals (in display currency) ───────────────────────────────
  function classTotals(classKey) {
    const cls = classByKey(classKey);
    let cost = 0, value = 0;
    for (const lot of (state.holdings[classKey] || [])) {
      const m = lotMetrics(lot);
      cost += m.cost; value += m.value;
    }
    const dCost  = toDisplay(cost, cls.ccy);
    const dValue = toDisplay(value, cls.ccy);
    return {
      key: classKey, label: cls.label, ccy: cls.ccy, color: window.CLASS_COLORS[classKey],
      costNative: cost, valueNative: value,
      cost: dCost, value: dValue, profit: dValue - dCost,
      pct: dCost ? ((dValue - dCost) / dCost) * 100 : 0,
      count: new Set((state.holdings[classKey] || []).map(l => l.name)).size,
    };
  }

  // ── Portfolio grand totals (in display currency) ───────────────────────────
  function grandTotals() {
    const classes = window.ASSET_CLASSES
      .map(c => classTotals(c.key))
      .filter(t => t.value > 0 || (state.holdings[t.key] || []).length);
    let cost = 0, value = 0;
    for (const t of classes) { cost += t.cost; value += t.value; }
    return { classes, cost, value, profit: value - cost, pct: cost ? ((value - cost) / cost) * 100 : 0 };
  }

  // ── Sector-level totals (in display currency) ──────────────────────────────
  function sectorTotals() {
    const map = new Map();
    for (const cls of window.ASSET_CLASSES) {
      for (const p of positions(cls.key)) {
        const sec  = p.sector || '—';
        const v    = toDisplay(p.value, cls.ccy);
        const c    = toDisplay(p.cost, cls.ccy);
        const entry = map.get(sec) || { value: 0, cost: 0 };
        entry.value += v; entry.cost += c;
        map.set(sec, entry);
      }
    }
    return [...map.entries()]
      .map(([sector, e]) => ({ sector, value: e.value, cost: e.cost }))
      .filter(s => s.value > 0 || s.cost > 0)
      .sort((a, b) => b.value - a.value);
  }

  function tagTotals() {
    const map = new Map();
    const allTags = state.tags || [];
    for (const cls of window.ASSET_CLASSES) {
      for (const pos of positions(cls.key)) {
        const key    = cls.key + ':' + pos.name;
        const tagIds = (state.holdingTags || {})[key] || [];
        if (!tagIds.length) continue;
        const v = toDisplay(pos.value, cls.ccy);
        const c = toDisplay(pos.cost, cls.ccy);
        for (const tagId of tagIds) {
          const tag = allTags.find(t => t.id === tagId);
          if (!tag) continue;
          const entry = map.get(tagId) || { tag, value: 0, cost: 0 };
          entry.value += v;
          entry.cost  += c;
          map.set(tagId, entry);
        }
      }
    }
    return [...map.values()]
      .map(e => ({ ...e, profit: e.value - e.cost, pct: e.cost ? (e.value - e.cost) / e.cost * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }

  function classByKey(k) { return window.ASSET_CLASSES.find(c => c.key === k); }

  // Build the correct transaction(s) for a debt payment or outstanding receipt.
  // CC-linked debt: must pay from a non-CC account → creates a transfer to the CC.
  //   Paying from any credit card is blocked (would be circular / fake payment).
  // Non-CC-linked debt: expense on the paying account.
  // Outstanding (lent) receipt: income on the receiving account.
  function _debtPayTx(debt, accountId, amount, date, note) {
    const txBase = { categoryId: null, toAccountId: null, fxRate: null, note };
    if (debt.direction === 'lent') {
      return [{ id: uid(), accountId, date, amount, flow: 'income', ...txBase }];
    }
    // borrowed
    const payingAcc   = wallet.accounts.find(a => a.id === accountId);
    const linkedAccId = debt.linkedAccountId;
    const linkedAcc   = linkedAccId ? wallet.accounts.find(a => a.id === linkedAccId) : null;
    const isLinkedCC  = linkedAcc && linkedAcc.type === 'credit_card';

    if (isLinkedCC) {
      // CC-linked debt: payment MUST come from a non-CC account.
      // Paying via any credit card is invalid — block it (return no transactions).
      if (!payingAcc || payingAcc.type === 'credit_card') return [];
      // Transfer from bank/cash/ewallet → linked CC (bank↓, CC↑)
      return [{ id: uid(), accountId, date, amount, flow: 'transfer', ...txBase, toAccountId: linkedAccId }];
    }

    // Non-CC-linked borrowed debt
    if (payingAcc && payingAcc.type === 'credit_card') {
      // Paying from a CC → income on that CC (reduces CC balance)
      return [{ id: uid(), accountId, date, amount, flow: 'income', ...txBase }];
    }
    return [{ id: uid(), accountId, date, amount, flow: 'expense', ...txBase }];
  }

  function _debtRemainingAmount(d) {
    if (!d.installment) return d.amount;
    const { months, interestRate, paidMonths } = d.installment;
    const totalInterest = d.amount * ((interestRate || 0) / 100) * (months / 12);
    const monthlyPayment = (d.amount + totalInterest) / months;
    return monthlyPayment * (months - (paidMonths || 0));
  }

  function _accBal(accountId) {
    const acc = wallet.accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    let b = acc.initialBal || 0;
    for (const t of wallet.transactions) {
      if (t.flow === 'transfer') {
        if (t.accountId   === accountId) b -= t.amount;
        if (t.toAccountId === accountId) {
          const to = wallet.accounts.find(a => a.id === t.toAccountId);
          const fr = wallet.accounts.find(a => a.id === t.accountId);
          b += (to && fr && to.currency !== fr.currency && t.fxRate) ? t.amount * t.fxRate : t.amount;
        }
      } else if (t.accountId === accountId) {
        b += t.flow === 'income' ? t.amount : -t.amount;
      }
    }
    return b;
  }

  // Compute "1 fromCcy = N toCcy" using THB as the pivot.
  function defaultFxRate(fromCcy, toCcy) {
    if (fromCcy === toCcy) return 1;
    const USDTHB = state.fx.USDTHB || window.SEED_FX_USDTHB;
    const JPYTHB = state.fx.JPYTHB || window.SEED_FX_JPYTHB;
    const KRWTHB = state.fx.KRWTHB || window.SEED_FX_KRWTHB;
    function toTHB(ccy) {
      if (ccy === 'THB') return 1;
      if (ccy === 'USD') return USDTHB;
      if (ccy === 'JPY') return JPYTHB;
      if (ccy === 'KRW') return KRWTHB;
      return 1;
    }
    function fromTHB(ccy) {
      if (ccy === 'THB') return 1;
      if (ccy === 'USD') return 1 / USDTHB;
      if (ccy === 'JPY') return 1 / JPYTHB;
      if (ccy === 'KRW') return 1 / KRWTHB;
      return 1;
    }
    return toTHB(fromCcy) * fromTHB(toCcy);
  }

  // Create a wallet transaction linked to an asset buy/sell.
  function _linkWalletTxn({ accountId, assetCcy, amount, flow, fxRate, note }) {
    if (!_walletInitialized || !accountId) return;
    const acc = wallet.accounts.find(a => a.id === accountId);
    if (!acc) return;
    const sameCcy = assetCcy === acc.currency;
    const rate    = sameCcy ? 1 : (fxRate || defaultFxRate(assetCcy, acc.currency));
    const linked  = (flow === 'income') ? 'cat_invest_in' : 'cat_invest_in';
    wallet.transactions.push({
      id: uid(), accountId, date: new Date().toISOString().slice(0, 10),
      amount: amount * rate, flow,
      categoryId: 'cat_invest_in', note,
      toAccountId: null, fxRate: sameCcy ? null : rate,
    });
    scheduleWalletSave();
  }

  // Portfolio total always in THB (for snapshots).
  function grandTotalInTHB() {
    const rate = state.fx.USDTHB || window.SEED_FX_USDTHB;
    let value = 0;
    for (const cls of window.ASSET_CLASSES) {
      for (const lot of (state.holdings[cls.key] || [])) {
        const m = lotMetrics(lot);
        value += cls.ccy === 'USD' ? m.value * rate : m.value;
      }
    }
    return value;
  }

  // ── Snapshot management ────────────────────────────────────────────────────
  function takeSnapshot() {
    const today = new Date().toISOString().slice(0, 10);
    const value = grandTotalInTHB();
    if (value <= 0) return;
    const rate = state.fx.USDTHB || window.SEED_FX_USDTHB;
    const snap = { date: today, value };
    for (const cls of window.ASSET_CLASSES) {
      let v = 0;
      for (const lot of (state.holdings[cls.key] || [])) {
        const m = lotMetrics(lot);
        v += cls.ccy === 'USD' ? m.value * rate : m.value;
      }
      snap[cls.key] = v;
    }
    const idx = state.snapshots.findIndex(s => s.date === today);
    if (idx >= 0) state.snapshots[idx] = snap;
    else state.snapshots.push(snap);
    if (state.snapshots.length > window.MAX_SNAPSHOTS) {
      state.snapshots = state.snapshots.slice(-window.MAX_SNAPSHOTS);
    }
  }

  // ── Live price helpers ─────────────────────────────────────────────────────
  function uniqueNames(classKey) {
    return [...new Set((state.holdings[classKey] || []).map(l => l.name))];
  }

  function buildApiRequest() {
    const yahoo = [], funds = [], crypto = [];
    for (const cls of window.ASSET_CLASSES) {
      if (!cls.live) continue;
      for (const name of uniqueNames(cls.key)) {
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
    for (const k in map) {
      const i = k.indexOf(':');
      const classKey = k.slice(0, i), name = k.slice(i + 1);
      const v = map[k];
      if (v == null || isNaN(v)) continue;
      (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +v; });
    }
  }

  // Direct CoinGecko + Frankfurter fallback when the /api/prices endpoint is unavailable.
  async function fallbackPrices() {
    const errors = [];
    try {
      const ids = [...new Set(Object.values(window.CRYPTO_MAP).map(m => m.id))].join(',');
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=thb');
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

  // ── Public Store API ───────────────────────────────────────────────────────
  const Store = {
    // ── Subscription ──────────────────────────────────────────────────────────
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get() { return state; },
    settings() { return state.settings; },
    prePostPrice(classKey, name) { return state.prePostPrices[`${classKey}:${name}`] || null; },

    // ── Settings mutations ─────────────────────────────────────────────────────
    setSetting(k, v) { state.settings[k] = v; emit(); },
    setSettings(obj) { Object.assign(state.settings, obj); emit(); },

    // ── Holdings mutations ─────────────────────────────────────────────────────
    addLot(classKey, lot, walletDeduction) {
      state.holdings[classKey] = state.holdings[classKey] || [];
      state.holdings[classKey].push({
        id: uid(), name: lot.name, type: lot.type || undefined,
        price: +lot.price, qty: +lot.qty,
        cur: lot.cur != null && lot.cur !== '' ? +lot.cur : +lot.price,
      });
      if (lot.sector) state.sectors[classKey + ':' + lot.name] = lot.sector;
      // Optionally deduct purchase cost from a wallet account
      if (walletDeduction && walletDeduction.accountId) {
        const cls  = classByKey(classKey);
        const cost = +lot.price * +lot.qty;
        _linkWalletTxn({
          accountId: walletDeduction.accountId,
          assetCcy:  cls ? cls.ccy : 'THB',
          amount:    cost,
          flow:      'expense',
          fxRate:    walletDeduction.exchangeRate || null,
          note:      `Buy ${window.fmtQty ? window.fmtQty(+lot.qty) : lot.qty} ${lot.name}`,
        });
      }
      emit();
    },
    updateLot(classKey, id, patch) {
      const arr = state.holdings[classKey] || [];
      const i = arr.findIndex(l => l.id === id);
      if (i < 0) return;
      const next = { ...arr[i] };
      if (patch.name  != null) next.name  = patch.name;
      if (patch.type  != null) next.type  = patch.type;
      if (patch.price != null && patch.price !== '') next.price = +patch.price;
      if (patch.qty   != null && patch.qty   !== '') next.qty   = +patch.qty;
      if (patch.cur   != null && patch.cur   !== '') next.cur   = +patch.cur;
      arr[i] = next;
      if (patch.sector != null) state.sectors[classKey + ':' + next.name] = patch.sector;
      emit();
    },
    deleteLot(classKey, id) {
      state.holdings[classKey] = (state.holdings[classKey] || []).filter(l => l.id !== id);
      emit();
    },
    setCurrentPrice(classKey, name, cur) {
      (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +cur; });
      emit();
    },
    setSector(classKey, name, sector) { state.sectors[classKey + ':' + name] = sector; emit(); },
    resetAll() { state = freshState(); emit(); },

    // ── Sell log mutations ─────────────────────────────────────────────────────
    recordSale(classKey, { date, name, ccy, buyPrice, sellPrice, qty }, walletCredit) {
      const cost       = +buyPrice * +qty;
      const proceeds   = +sellPrice * +qty;
      const realizedPnl = proceeds - cost;
      const pnlPct     = cost ? (realizedPnl / cost) * 100 : 0;
      state.sales = state.sales || [];
      state.sales.push({ id: uid(), date, classKey, name, ccy,
        buyPrice: +buyPrice, sellPrice: +sellPrice, qty: +qty,
        cost, proceeds, realizedPnl, pnlPct });
      // Optionally credit sale proceeds to a wallet account
      if (walletCredit && walletCredit.accountId) {
        _linkWalletTxn({
          accountId: walletCredit.accountId,
          assetCcy:  ccy || 'THB',
          amount:    proceeds,
          flow:      'income',
          fxRate:    walletCredit.exchangeRate || null,
          note:      `Sell ${window.fmtQty ? window.fmtQty(+qty) : qty} ${name}`,
        });
      }
      emit();
    },
    deleteSale(id) { state.sales = (state.sales || []).filter(s => s.id !== id); emit(); },

    // ── Sell log read helpers ──────────────────────────────────────────────────
    getSales() { return state.sales || []; },
    salesSummary() {
      const sales = state.sales || [];
      const rate  = state.fx.USDTHB || window.SEED_FX_USDTHB;
      const map   = new Map();
      for (const s of sales) {
        const year  = s.date.slice(0, 4);
        const toTHB = v => s.ccy === 'USD' ? v * rate : v;
        if (!map.has(year)) map.set(year, { year, cost: 0, proceeds: 0, pnl: 0, count: 0 });
        const y = map.get(year);
        y.cost += toTHB(s.cost); y.proceeds += toTHB(s.proceeds); y.pnl += toTHB(s.realizedPnl); y.count++;
      }
      return [...map.values()]
        .map(y => ({ ...y, pnlPct: y.cost ? (y.pnl / y.cost) * 100 : 0 }))
        .sort((a, b) => b.year.localeCompare(a.year));
    },

    // ── Tag mutations ──────────────────────────────────────────────────────────
    addTag(name, color) {
      const id = uid();
      state.tags = state.tags || [];
      state.tags.push({ id, name: name.trim(), color: color || '#6b7280' });
      emit();
      return id;
    },
    deleteTag(id) {
      state.tags = (state.tags || []).filter(t => t.id !== id);
      const ht = state.holdingTags || {};
      for (const key of Object.keys(ht)) {
        ht[key] = ht[key].filter(tid => tid !== id);
        if (!ht[key].length) delete ht[key];
      }
      emit();
    },
    updateTag(id, patch) {
      const tags = state.tags || [];
      const i = tags.findIndex(t => t.id === id);
      if (i < 0) return;
      tags[i] = { ...tags[i], ...patch };
      emit();
    },
    setHoldingTags(key, tagIds) {
      state.holdingTags = state.holdingTags || {};
      if (!tagIds || !tagIds.length) {
        delete state.holdingTags[key];
      } else {
        state.holdingTags[key] = tagIds;
      }
      emit();
    },
    getTags:        () => state.tags || [],
    getHoldingTags: (key) => (state.holdingTags || {})[key] || [],

    // ── Read helpers (derived data) ────────────────────────────────────────────
    positions, classTotals, grandTotals, sectorTotals, tagTotals, classByKey, toDisplay, lotMetrics,
    walletToDisplay, defaultFxRate,
    getSnapshots: () => state.snapshots,
    autoSnapshot() { takeSnapshot(); emit(); },

    // ── Wallet read helpers ────────────────────────────────────────────────────
    getWallet: () => wallet,

    accountBalance: (accountId) => _accBal(accountId),

    monthlyFlow(year, month) {
      let income = 0, expense = 0;
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      for (const t of wallet.transactions) {
        if (!t.date.startsWith(prefix)) continue;
        const acc = wallet.accounts.find(a => a.id === t.accountId);
        const ccy = acc ? acc.currency : 'THB';
        const inDisp = walletToDisplay(t.amount, ccy);
        if (t.flow === 'income')   income  += inDisp;
        if (t.flow === 'expense')  expense += inDisp;
      }
      return { income, expense };
    },

    debtSummary() {
      let totalLent = 0, totalBorrowed = 0, monthlyInstallment = 0;
      for (const d of wallet.debts) {
        if (d.settled) continue;
        const inDisp = walletToDisplay(_debtRemainingAmount(d), d.currency);
        if (d.direction === 'lent')     totalLent     += inDisp;
        if (d.direction === 'borrowed') totalBorrowed += inDisp;
        if (d.installment) {
          const remaining = d.installment.months - (d.installment.paidMonths || 0);
          if (remaining > 0) {
            const ti = d.amount * ((d.installment.interestRate || 0) / 100) * (d.installment.months / 12);
            monthlyInstallment += walletToDisplay((d.amount + ti) / d.installment.months, d.currency);
          }
        }
      }
      return { totalLent, totalBorrowed, monthlyInstallment };
    },

    // Net worth: portfolio + cash + credit card debt + borrowed debts
    netWorthSummary() {
      const portValue = grandTotals().value;
      let cashTotal = 0, creditDebt = 0, borrowedDebt = 0;

      for (const acc of wallet.accounts.filter(a => !a.archived)) {
        const bal = _accBal(acc.id);
        if (acc.type === 'credit_card') {
          // balance < 0 means debt (expense > income on the card)
          if (bal < 0) creditDebt += walletToDisplay(-bal, acc.currency);
        } else {
          if (bal > 0) cashTotal += walletToDisplay(bal, acc.currency);
        }
      }
      for (const d of wallet.debts) {
        if (!d.settled && d.direction === 'borrowed') {
          // Skip CC-linked debts — their liability is already captured in creditDebt via the CC account balance
          if (d.linkedAccountId) {
            const la = wallet.accounts.find(a => a.id === d.linkedAccountId);
            if (la && la.type === 'credit_card') continue;
          }
          borrowedDebt += walletToDisplay(_debtRemainingAmount(d), d.currency);
        }
      }

      const totalAssets      = portValue + cashTotal;
      const totalLiabilities = creditDebt + borrowedDebt;
      return { portValue, cashTotal, creditDebt, borrowedDebt, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
    },

    // Last numMonths months of income/expense in display currency
    walletMonthlyData(numMonths) {
      numMonths = numMonths || 6;
      const now = new Date();
      return Array.from({ length: numMonths }, (_, i) => {
        const d    = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1 - i), 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let income = 0, expense = 0;
        for (const t of wallet.transactions) {
          if (!t.date.startsWith(prefix)) continue;
          const acc  = wallet.accounts.find(a => a.id === t.accountId);
          const ccy  = acc ? acc.currency : 'THB';
          const amt  = walletToDisplay(t.amount, ccy);
          if (t.flow === 'income')  income  += amt;
          if (t.flow === 'expense') expense += amt;
        }
        const label = d.toLocaleString('en', { month: 'short' });
        return { month: prefix, label, income, expense };
      });
    },

    // Income and expense by category for a given month ('YYYY-MM')
    walletCategoryData(monthPrefix) {
      const incMap = new Map(), expMap = new Map();
      for (const t of wallet.transactions) {
        if (!t.date.startsWith(monthPrefix)) continue;
        const acc  = wallet.accounts.find(a => a.id === t.accountId);
        const ccy  = acc ? acc.currency : 'THB';
        const amt  = walletToDisplay(t.amount, ccy);
        const cat  = wallet.categories.find(c => c.id === t.categoryId);
        const key  = cat ? cat.name : 'Uncategorized';
        const col  = cat ? (cat.color || '#6b7280') : '#6b7280';
        if (t.flow === 'income')  { const e = incMap.get(key) || { value: 0, color: col }; e.value += amt; incMap.set(key, e); }
        if (t.flow === 'expense') { const e = expMap.get(key) || { value: 0, color: col }; e.value += amt; expMap.set(key, e); }
      }
      const toSegs = m => [...m.entries()].map(([label, v]) => ({ label, value: v.value, color: v.color })).sort((a, b) => b.value - a.value);
      return { income: toSegs(incMap), expense: toSegs(expMap) };
    },

    // ── Wallet accounts mutations ──────────────────────────────────────────────
    addAccount(data) {
      wallet.accounts.push({
        id: uid(), name: data.name, type: data.type || 'bank',
        currency: data.currency || 'THB', color: data.color || null,
        initialBal: +data.initialBal || 0,
        creditLimit: data.creditLimit != null ? +data.creditLimit : null,
        sortOrder: wallet.accounts.length, archived: false,
      });
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    updateAccount(id, patch) {
      const i = wallet.accounts.findIndex(a => a.id === id);
      if (i < 0) return;
      wallet.accounts[i] = { ...wallet.accounts[i], ...patch };
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    deleteAccount(id) {
      wallet.accounts = wallet.accounts.filter(a => a.id !== id);
      wallet.transactions = wallet.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
      subs.forEach(fn => fn()); scheduleWalletSave();
    },

    // ── Wallet categories mutations ────────────────────────────────────────────
    addCategory(data) {
      wallet.categories.push({ id: uid(), name: data.name, flow: data.flow, icon: data.icon || null, color: data.color || null });
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    deleteCategory(id) {
      wallet.categories = wallet.categories.filter(c => c.id !== id);
      subs.forEach(fn => fn()); scheduleWalletSave();
    },

    // ── Wallet transaction mutations ───────────────────────────────────────────
    addTransaction(data) {
      wallet.transactions.push({
        id: uid(), accountId: data.accountId, date: data.date,
        amount: +data.amount, flow: data.flow,
        categoryId: data.categoryId || null,
        note: data.note || '',
        toAccountId: data.toAccountId || null,
        fxRate: data.fxRate != null ? +data.fxRate : null,
      });
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    updateTransaction(id, patch) {
      const i = wallet.transactions.findIndex(t => t.id === id);
      if (i < 0) return;
      wallet.transactions[i] = { ...wallet.transactions[i], ...patch };
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    deleteTransaction(id) {
      wallet.transactions = wallet.transactions.filter(t => t.id !== id);
      subs.forEach(fn => fn()); scheduleWalletSave();
    },

    // ── Wallet debt mutations ──────────────────────────────────────────────────
    addDebt(data) {
      wallet.debts.push({
        id: uid(), direction: data.direction, counterparty: data.counterparty,
        amount: +data.amount, currency: data.currency || 'THB',
        dateStart: data.dateStart, dateDue: data.dateDue || null,
        note: data.note || '', settled: false, settledDate: null,
        installment: data.installment || null,
        linkedAccountId: data.linkedAccountId || null,
      });
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    updateDebt(id, patch) {
      const i = wallet.debts.findIndex(d => d.id === id);
      if (i < 0) return;
      wallet.debts[i] = { ...wallet.debts[i], ...patch };
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    settleDebt(id, settledDate, accountId) {
      const i = wallet.debts.findIndex(d => d.id === id);
      if (i < 0) return;
      const debt = wallet.debts[i];
      const resolvedDate = settledDate || new Date().toISOString().slice(0, 10);
      wallet.debts[i] = { ...debt, settled: true, settledDate: resolvedDate };
      if (accountId) {
        // For CC-linked debts cap at actual CC balance to prevent overpayment
        let remaining = _debtRemainingAmount(debt);
        if (debt.direction === 'borrowed' && debt.linkedAccountId) {
          const la = wallet.accounts.find(a => a.id === debt.linkedAccountId);
          if (la && la.type === 'credit_card') {
            remaining = Math.min(remaining, Math.max(0, -_accBal(debt.linkedAccountId)));
          }
        }
        if (remaining > 0) {
          const tx = _debtPayTx(debt, accountId, remaining, resolvedDate,
            debt.direction === 'borrowed' ? `Debt settled: ${debt.counterparty}` : `Outstanding received: ${debt.counterparty}`);
          tx.forEach(t => wallet.transactions.push(t));
        }
      }
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    deleteDebt(id) {
      wallet.debts = wallet.debts.filter(d => d.id !== id);
      subs.forEach(fn => fn()); scheduleWalletSave();
    },
    payInstallmentMonth(id, accountId, date) {
      const i = wallet.debts.findIndex(d => d.id === id);
      if (i < 0) return;
      const debt = wallet.debts[i];
      if (!debt.installment) return;
      const paid = (debt.installment.paidMonths || 0) + 1;
      const done = paid >= debt.installment.months;
      const resolvedDate = date || new Date().toISOString().slice(0, 10);
      wallet.debts[i] = {
        ...debt,
        installment: { ...debt.installment, paidMonths: paid },
        settled: done || debt.settled,
        settledDate: done && !debt.settled ? resolvedDate : debt.settledDate,
      };
      if (accountId) {
        const ti = debt.amount * ((debt.installment.interestRate || 0) / 100) * (debt.installment.months / 12);
        // Installment payments use the contracted fixed monthly amount — no CC balance cap.
        // Pre-payments via direct transfers are separate and may cause the CC to go positive,
        // which is correct (the user over-paid the card but fulfilled the contract).
        const monthlyPayment = (debt.amount + ti) / debt.installment.months;
        const label = debt.direction === 'borrowed'
          ? `Debt payment: ${debt.counterparty} (${paid}/${debt.installment.months})`
          : `Outstanding received: ${debt.counterparty} (${paid}/${debt.installment.months})`;
        if (monthlyPayment > 0) {
          const tx = _debtPayTx(debt, accountId, monthlyPayment, resolvedDate, label);
          tx.forEach(t => wallet.transactions.push(t));
        }
      }
      subs.forEach(fn => fn()); scheduleWalletSave();
    },

    // ── Wallet cloud sync ──────────────────────────────────────────────────────
    loadWalletFromCloud,

    // ── DB sync ────────────────────────────────────────────────────────────────
    getPortfolioId: () => portfolioId,
    setPrimaryId(newId) {
      if (!newId || !/^[a-zA-Z0-9_-]{6,64}$/.test(newId)) return;
      portfolioId = newId;
      try { localStorage.setItem(USER_ID_KEY, newId); } catch (_) {}
    },
    loadFromCloud:  (id) => loadFromCloud(id),
    setPortfolioId: (newId) => loadFromCloud(newId),
    getDbStatus:    () => ({ status: _dbStatus, savedAt: _dbSavedAt }),
    forceSave:      () => { clearTimeout(_saveTimer); return doCloudSave(); },

    // ── Data export / import ───────────────────────────────────────────────────
    async exportData() {
      const id = portfolioId;
      const [pRes, wRes] = await Promise.all([
        fetch(`/api/portfolio?id=${encodeURIComponent(id)}`),
        fetch(`/api/wallet?id=${encodeURIComponent(id)}`),
      ]);
      if (!pRes.ok) throw new Error('export-portfolio-failed');
      if (!wRes.ok) throw new Error('export-wallet-failed');
      const pJson = await pRes.json();
      const wJson = await wRes.json();
      const portfolio = pJson.data  ? JSON.parse(pJson.data)  : null;
      const wallet    = wJson.data  ? JSON.parse(wJson.data)  : null;
      return { portfolio, wallet, exportedAt: new Date().toISOString(), version: 1 };
    },

    async importData({ portfolio, wallet, mode }) {
      const r = await fetch('/api/data-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: portfolioId, mode, portfolio, wallet }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'import-failed');
      }
      await Promise.all([loadFromCloud(), loadWalletFromCloud()]);
      subs.forEach(fn => fn());
    },

    // ── Live prices ────────────────────────────────────────────────────────────
    async refreshPrices() {
      const apiReq = buildApiRequest();
      try {
        const r = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiReq),
        });
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.includes('application/json')) throw new Error('no-api');
        const data = await r.json();
        if (!data || typeof data.prices !== 'object') throw new Error('bad-api');
        applyPrices(data.prices);
        state.prePostPrices = (data.prePost && typeof data.prePost === 'object') ? data.prePost : {};
        if (data.fx && data.fx.USDTHB) {
          state.fx = {
            USDTHB: data.fx.USDTHB,
            JPYTHB: data.fx.JPYTHB || state.fx.JPYTHB || window.SEED_FX_JPYTHB,
            KRWTHB: data.fx.KRWTHB || state.fx.KRWTHB || window.SEED_FX_KRWTHB,
            at: Date.now(),
          };
        }
        state.priceMode   = 'api';
        state.priceErrors = data.errors || [];
        state.lastPriceSync = Date.now();
        takeSnapshot();
        emit();
        return { mode: 'api', errors: data.errors || [] };
      } catch (_) {
        const res = await fallbackPrices();
        state.priceMode     = 'fallback';
        state.lastPriceSync = Date.now();
        takeSnapshot();
        emit();
        return { mode: 'fallback', ...res };
      }
    },
  };

  window.Store = Store;
})();
