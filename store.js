/* eslint-disable */
/* ============================================================================
   store.js — App state, persistence, calculations, live prices.
   Plain JS singleton with a tiny pub/sub. UI subscribes via Store.subscribe.

   DATA SOURCE: Supabase only (via /api/portfolio).
   portfolioId is kept in localStorage solely as an identity token — no
   portfolio data is ever read from or written to localStorage.
   ============================================================================ */
(function () {
  const USER_ID_KEY = 'portfolio.userId';
  const uid = () => Math.random().toString(36).slice(2, 9);

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

  const DEFAULT_SETTINGS = {
    displayCcy: 'THB',
    theme: 'light',
    chartStyle: 'donut',
    palette: 'class',
    layout: 'overview',
    decimals: 2,
  };

  function freshState() {
    const holdings = {};
    for (const cls of window.ASSET_CLASSES) {
      holdings[cls.key] = [];
    }
    return {
      holdings,
      sectors: { ...window.SEED_SECTORS },
      fx: { USDTHB: window.SEED_FX_USDTHB, at: null },
      settings: { ...DEFAULT_SETTINGS },
      lastPriceSync: null,
      priceMode: null,
      priceErrors: [],
      snapshots: [],
      sales: [],
    };
  }

  let state = freshState();

  let _dbStatus = 'idle'; // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  let _dbSavedAt = null;
  // Guard: never write to DB before loadFromCloud has run at least once.
  // Prevents autoSnapshot (or any early emit) from overwriting DB data with
  // an empty freshState before we know what's actually stored.
  let _initialized = false;

  // ── Supabase sync (via /api/portfolio) ───────────────────────────────────
  let _saveTimer = null;

  function buildSavePayload() {
    return JSON.stringify({
      holdings: state.holdings, sectors: state.sectors, fx: state.fx,
      settings: state.settings, lastPriceSync: state.lastPriceSync,
      priceMode: state.priceMode, snapshots: state.snapshots, sales: state.sales,
    });
  }

  function restoreFromSaved(saved) {
    const base = freshState();
    return {
      holdings: saved.holdings || base.holdings,
      sectors: { ...base.sectors, ...(saved.sectors || {}) },
      fx: saved.fx || base.fx,
      settings: { ...base.settings, ...(saved.settings || {}) },
      lastPriceSync: saved.lastPriceSync || null,
      priceMode: saved.priceMode || null,
      priceErrors: [],
      snapshots: (saved.snapshots || []).slice(-730),
      sales: saved.sales || [],
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
        r.json().then(j => console.warn('[portfolio] db save failed:', r.status, j?.detail || j?.error || '')).catch(() => {});
      }
    } catch (e) {
      _dbStatus = 'error';
      console.warn('[portfolio] db save error:', e.message);
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

  // ── pub/sub ───────────────────────────────────────────────────────────────
  const subs = new Set();
  function emit() { scheduleCloudSave(); subs.forEach(fn => fn()); }

  // ── Currency conversion ───────────────────────────────────────────────────
  function toDisplay(amount, nativeCcy) {
    const disp = state.settings.displayCcy;
    if (nativeCcy === disp) return amount;
    const rate = state.fx.USDTHB || window.SEED_FX_USDTHB;
    if (nativeCcy === 'USD' && disp === 'THB') return amount * rate;
    if (nativeCcy === 'THB' && disp === 'USD') return amount / rate;
    return amount;
  }

  // ── Lot maths ─────────────────────────────────────────────────────────────
  function lotMetrics(lot) {
    const cost = lot.price * lot.qty;
    const value = (lot.cur != null ? lot.cur : lot.price) * lot.qty;
    const profit = value - cost;
    const pct = cost ? (profit / cost) * 100 : 0;
    return { cost, value, profit, pct };
  }

  function positions(classKey) {
    const cls = classByKey(classKey);
    const lots = state.holdings[classKey] || [];
    const map = new Map();
    for (const lot of lots) {
      const key = lot.name;
      if (!map.has(key)) {
        map.set(key, { name: lot.name, type: lot.type || null, ccy: cls.ccy, qty: 0, cost: 0, value: 0, lots: [], cur: lot.cur });
      }
      const m = lotMetrics(lot);
      const p = map.get(key);
      p.qty += lot.qty; p.cost += m.cost; p.value += m.value;
      p.cur = lot.cur; p.lots.push({ ...lot, ...m });
    }
    const out = [];
    for (const p of map.values()) {
      p.avgPrice = p.qty ? p.cost / p.qty : 0;
      p.profit = p.value - p.cost;
      p.pct = p.cost ? (p.profit / p.cost) * 100 : 0;
      p.sector = state.sectors[classKey + ':' + p.name] || (p.type || '—');
      p.classKey = classKey;
      out.push(p);
    }
    out.sort((a, b) => b.value - a.value);
    return out;
  }

  function classTotals(classKey) {
    const cls = classByKey(classKey);
    let cost = 0, value = 0;
    for (const lot of (state.holdings[classKey] || [])) {
      const m = lotMetrics(lot);
      cost += m.cost; value += m.value;
    }
    const dCost = toDisplay(cost, cls.ccy), dValue = toDisplay(value, cls.ccy);
    return {
      key: classKey, label: cls.label, ccy: cls.ccy, color: window.CLASS_COLORS[classKey],
      costNative: cost, valueNative: value,
      cost: dCost, value: dValue, profit: dValue - dCost,
      pct: dCost ? ((dValue - dCost) / dCost) * 100 : 0,
      count: new Set((state.holdings[classKey] || []).map(l => l.name)).size,
    };
  }

  function grandTotals() {
    const classes = window.ASSET_CLASSES.map(c => classTotals(c.key)).filter(t => t.value > 0 || (state.holdings[t.key] || []).length);
    let cost = 0, value = 0;
    for (const t of classes) { cost += t.cost; value += t.value; }
    return { classes, cost, value, profit: value - cost, pct: cost ? ((value - cost) / cost) * 100 : 0 };
  }

  function sectorTotals() {
    const map = new Map();
    for (const cls of window.ASSET_CLASSES) {
      for (const p of positions(cls.key)) {
        const sec = p.sector || '—';
        const v = toDisplay(p.value, cls.ccy);
        const c = toDisplay(p.cost, cls.ccy);
        const entry = map.get(sec) || { value: 0, cost: 0 };
        entry.value += v;
        entry.cost += c;
        map.set(sec, entry);
      }
    }
    return [...map.entries()].map(([sector, e]) => ({ sector, value: e.value, cost: e.cost }))
      .filter(s => s.value > 0 || s.cost > 0).sort((a, b) => b.value - a.value);
  }

  function classByKey(k) { return window.ASSET_CLASSES.find(c => c.key === k); }

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

  function takeSnapshot() {
    const today = new Date().toISOString().slice(0, 10);
    const value = grandTotalInTHB();
    if (value <= 0) return;
    const idx = state.snapshots.findIndex(s => s.date === today);
    if (idx >= 0) state.snapshots[idx] = { date: today, value };
    else state.snapshots.push({ date: today, value });
    if (state.snapshots.length > 730) state.snapshots = state.snapshots.slice(-730);
  }

  // ── Live price plumbing ───────────────────────────────────────────────────
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

  async function fallbackPrices() {
    const errors = []; let crypto = false, fx = false;
    try {
      const ids = [...new Set(Object.values(window.CRYPTO_MAP).map(m => m.id))].join(',');
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=thb');
      if (r.ok) {
        const j = await r.json();
        (state.holdings.crypto || []).forEach(l => { const m = window.CRYPTO_MAP[l.name]; if (m && j[m.id] && j[m.id].thb) l.cur = j[m.id].thb; });
        crypto = true;
      }
    } catch (e) { errors.push('crypto'); }
    try {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=THB');
      if (r.ok) { const j = await r.json(); if (j && j.rates && j.rates.THB) { state.fx = { USDTHB: j.rates.THB, at: Date.now() }; fx = true; } }
    } catch (e) { errors.push('fx'); }
    return { crypto, fx, errors };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const Store = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get() { return state; },
    settings() { return state.settings; },

    setSetting(k, v) { state.settings[k] = v; emit(); },
    setSettings(obj) { Object.assign(state.settings, obj); emit(); },

    addLot(classKey, lot) {
      state.holdings[classKey] = state.holdings[classKey] || [];
      state.holdings[classKey].push({
        id: uid(), name: lot.name, type: lot.type || undefined,
        price: +lot.price, qty: +lot.qty,
        cur: lot.cur != null && lot.cur !== '' ? +lot.cur : +lot.price,
      });
      if (lot.sector) state.sectors[classKey + ':' + lot.name] = lot.sector;
      emit();
    },
    updateLot(classKey, id, patch) {
      const arr = state.holdings[classKey] || [];
      const i = arr.findIndex(l => l.id === id);
      if (i >= 0) {
        const next = { ...arr[i] };
        if (patch.name  != null) next.name  = patch.name;
        if (patch.type  != null) next.type  = patch.type;
        if (patch.price != null && patch.price !== '') next.price = +patch.price;
        if (patch.qty   != null && patch.qty   !== '') next.qty   = +patch.qty;
        if (patch.cur   != null && patch.cur   !== '') next.cur   = +patch.cur;
        arr[i] = next;
        if (patch.sector != null) state.sectors[classKey + ':' + next.name] = patch.sector;
        emit();
      }
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

    // ── Sell log ─────────────────────────────────────────────────────────────
    recordSale(classKey, { date, name, ccy, buyPrice, sellPrice, qty }) {
      const cost = +buyPrice * +qty;
      const proceeds = +sellPrice * +qty;
      const realizedPnl = proceeds - cost;
      const pnlPct = cost ? (realizedPnl / cost) * 100 : 0;
      state.sales = state.sales || [];
      state.sales.push({ id: uid(), date, classKey, name, ccy,
        buyPrice: +buyPrice, sellPrice: +sellPrice, qty: +qty,
        cost, proceeds, realizedPnl, pnlPct });
      emit();
    },
    deleteSale(id) { state.sales = (state.sales || []).filter(s => s.id !== id); emit(); },
    getSales() { return state.sales || []; },
    salesSummary() {
      const sales = state.sales || [];
      const rate = state.fx.USDTHB || window.SEED_FX_USDTHB;
      const map = new Map();
      for (const s of sales) {
        const year = s.date.slice(0, 4);
        const toTHB = v => s.ccy === 'USD' ? v * rate : v;
        if (!map.has(year)) map.set(year, { year, cost: 0, proceeds: 0, pnl: 0, count: 0 });
        const y = map.get(year);
        y.cost += toTHB(s.cost); y.proceeds += toTHB(s.proceeds); y.pnl += toTHB(s.realizedPnl); y.count++;
      }
      return [...map.values()]
        .map(y => ({ ...y, pnlPct: y.cost ? (y.pnl / y.cost) * 100 : 0 }))
        .sort((a, b) => b.year.localeCompare(a.year));
    },

    // ── Read helpers ──────────────────────────────────────────────────────────
    positions, classTotals, grandTotals, sectorTotals, classByKey, toDisplay, lotMetrics,
    getSnapshots: () => state.snapshots,
    autoSnapshot() { takeSnapshot(); emit(); },

    // ── DB sync ───────────────────────────────────────────────────────────────
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

    // ── Live prices ───────────────────────────────────────────────────────────
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
        if (data.fx && data.fx.USDTHB) state.fx = { USDTHB: data.fx.USDTHB, at: Date.now() };
        state.priceMode = 'api';
        state.priceErrors = data.errors || [];
        state.lastPriceSync = Date.now();
        takeSnapshot();
        emit();
        return { mode: 'api', errors: data.errors || [] };
      } catch (e) {
        const res = await fallbackPrices();
        state.priceMode = 'fallback';
        state.lastPriceSync = Date.now();
        takeSnapshot();
        emit();
        return { mode: 'fallback', ...res };
      }
    },
  };

  window.Store = Store;
})();
