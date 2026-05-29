/* eslint-disable */
/* ============================================================================
   store.js — App state, persistence, calculations, live prices.
   Plain JS singleton with a tiny pub/sub. UI subscribes via Store.subscribe.
   ============================================================================ */
(function () {
  const LS_KEY      = 'portfolio.v1';
  const USER_ID_KEY  = 'portfolio.userId';
  const uid = () => Math.random().toString(36).slice(2, 9);

  // Stable per-browser ID used as the KV key for cloud sync.
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
    displayCcy: 'THB',     // 'THB' | 'USD'
    theme: 'light',        // 'light' | 'dark'
    chartStyle: 'donut',   // 'donut' | 'pie'
    palette: 'class',      // 'class' | 'warm' | 'cool'
    layout: 'overview',    // 'overview' | 'compact' | 'visual'
    decimals: 2,
  };

  function freshState() {
    const holdings = {};
    for (const cls of window.ASSET_CLASSES) {
      holdings[cls.key] = (window.SEED_HOLDINGS[cls.key] || []).map(l => ({ id: uid(), ...l }));
    }
    return {
      holdings,
      sectors: { ...window.SEED_SECTORS },
      fx: { USDTHB: window.SEED_FX_USDTHB, at: null },
      settings: { ...DEFAULT_SETTINGS },
      lastPriceSync: null,
      priceMode: null,
      priceErrors: [],
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return freshState();
      const saved = JSON.parse(raw);
      const base = freshState();
      return {
        holdings: saved.holdings || base.holdings,
        sectors: { ...base.sectors, ...(saved.sectors || {}) },
        fx: saved.fx || base.fx,
        settings: { ...base.settings, ...(saved.settings || {}) },
        lastPriceSync: saved.lastPriceSync || null,
        priceMode: saved.priceMode || null,
        priceErrors: [],
      };
    } catch (e) {
      return freshState();
    }
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---- cloud sync (Vercel KV) ----------------------------------------------
  let _saveTimer = null;
  function scheduleCloudSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(doCloudSave, 2000); // debounce 2 s
  }

  async function doCloudSave() {
    try {
      const data = JSON.stringify({
        holdings: state.holdings, sectors: state.sectors, fx: state.fx,
        settings: state.settings, lastPriceSync: state.lastPriceSync, priceMode: state.priceMode,
      });
      await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: portfolioId, data }),
      });
    } catch (_) {} // localStorage remains source of truth on failure
  }

  async function loadFromCloud(overrideId) {
    const id = overrideId || portfolioId;
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) return false;
    try {
      const r = await fetch('/api/portfolio?id=' + encodeURIComponent(id));
      if (!r.ok) return false;
      const j = await r.json();
      if (!j || !j.data) return false;
      const saved = JSON.parse(j.data);
      if (!saved || typeof saved !== 'object') return false;
      // Switch active portfolio ID when loading from a different device
      if (overrideId && overrideId !== portfolioId) {
        portfolioId = overrideId;
        try { localStorage.setItem(USER_ID_KEY, overrideId); } catch (_) {}
      }
      const base = freshState();
      state = {
        holdings: saved.holdings || base.holdings,
        sectors: { ...base.sectors, ...(saved.sectors || {}) },
        fx: saved.fx || base.fx,
        settings: { ...base.settings, ...(saved.settings || {}) },
        lastPriceSync: saved.lastPriceSync || null,
        priceMode: saved.priceMode || null,
        priceErrors: [],
      };
      persist();
      subs.forEach(fn => fn()); // notify without triggering another cloud save
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- pub/sub -------------------------------------------------------------
  const subs = new Set();
  function emit() { persist(); scheduleCloudSave(); subs.forEach(fn => fn()); }

  // ---- currency conversion -------------------------------------------------
  function toDisplay(amount, nativeCcy) {
    const disp = state.settings.displayCcy;
    if (nativeCcy === disp) return amount;
    const rate = state.fx.USDTHB || window.SEED_FX_USDTHB;
    if (nativeCcy === 'USD' && disp === 'THB') return amount * rate;
    if (nativeCcy === 'THB' && disp === 'USD') return amount / rate;
    return amount;
  }

  // ---- lot maths -----------------------------------------------------------
  function lotMetrics(lot) {
    const cost = lot.price * lot.qty;
    const value = (lot.cur != null ? lot.cur : lot.price) * lot.qty;
    const profit = value - cost;
    const pct = cost ? (profit / cost) * 100 : 0;
    return { cost, value, profit, pct };
  }

  // Aggregate lots of a class into net positions keyed by name.
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

  // Totals per class, converted to display currency.
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
    return {
      classes, cost, value, profit: value - cost,
      pct: cost ? ((value - cost) / cost) * 100 : 0,
    };
  }

  // Sector breakdown across all classes (display ccy).
  function sectorTotals() {
    const map = new Map();
    for (const cls of window.ASSET_CLASSES) {
      for (const p of positions(cls.key)) {
        const sec = p.sector || '—';
        const v = toDisplay(p.value, cls.ccy);
        map.set(sec, (map.get(sec) || 0) + v);
      }
    }
    return [...map.entries()].map(([sector, value]) => ({ sector, value }))
      .filter(s => s.value > 0).sort((a, b) => b.value - a.value);
  }

  function classByKey(k) { return window.ASSET_CLASSES.find(c => c.key === k); }

  // ---- live-price plumbing -------------------------------------------------
  function uniqueNames(classKey) {
    return [...new Set((state.holdings[classKey] || []).map(l => l.name))];
  }

  // Build the POST payload for /api/prices from current holdings.
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

  // Apply { "<classKey>:<name>": price } to every matching lot's current price.
  function applyPrices(map) {
    for (const k in map) {
      const i = k.indexOf(':');
      const classKey = k.slice(0, i), name = k.slice(i + 1);
      const v = map[k];
      if (v == null || isNaN(v)) continue;
      (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +v; });
    }
  }

  // Browser-only fallback when the serverless API isn't reachable.
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

  // ---- mutations -----------------------------------------------------------
  const Store = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get() { return state; },
    settings() { return state.settings; },

    setSetting(k, v) { state.settings[k] = v; emit(); },
    setSettings(obj) { Object.assign(state.settings, obj); emit(); },

    addLot(classKey, lot) {
      state.holdings[classKey] = state.holdings[classKey] || [];
      state.holdings[classKey].push({ id: uid(), name: lot.name, type: lot.type || undefined,
        price: +lot.price, qty: +lot.qty, cur: lot.cur != null && lot.cur !== '' ? +lot.cur : +lot.price });
      if (lot.sector) state.sectors[classKey + ':' + lot.name] = lot.sector;
      emit();
    },
    updateLot(classKey, id, patch) {
      const arr = state.holdings[classKey] || [];
      const i = arr.findIndex(l => l.id === id);
      if (i >= 0) {
        const next = { ...arr[i] };
        if (patch.name != null) next.name = patch.name;
        if (patch.type != null) next.type = patch.type;
        if (patch.price != null && patch.price !== '') next.price = +patch.price;
        if (patch.qty != null && patch.qty !== '') next.qty = +patch.qty;
        if (patch.cur != null && patch.cur !== '') next.cur = +patch.cur;
        arr[i] = next;
        if (patch.sector != null) state.sectors[classKey + ':' + next.name] = patch.sector;
        emit();
      }
    },
    deleteLot(classKey, id) {
      state.holdings[classKey] = (state.holdings[classKey] || []).filter(l => l.id !== id);
      emit();
    },
    // Update current price for ALL lots of a ticker (manual classes).
    setCurrentPrice(classKey, name, cur) {
      (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +cur; });
      emit();
    },
    setSector(classKey, name, sector) {
      state.sectors[classKey + ':' + name] = sector; emit();
    },
    resetAll() {
      state = freshState(); emit();
    },

    // ---- read helpers ------------------------------------------------------
    positions, classTotals, grandTotals, sectorTotals, classByKey, toDisplay, lotMetrics,

    // ---- cloud sync -------------------------------------------------------
    getPortfolioId: () => portfolioId,
    loadFromCloud:  (id) => loadFromCloud(id),
    setPortfolioId: (newId) => loadFromCloud(newId),

    // ---- live prices -------------------------------------------------------
    // Try the deployed serverless API first (handles every class). If it isn't
    // reachable (static hosting / this preview), fall back to the two
    // CORS-friendly browser sources: CoinGecko (crypto) + Frankfurter (FX).
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
        emit();
        return { mode: 'api', errors: data.errors || [] };
      } catch (e) {
        const res = await fallbackPrices();
        state.priceMode = 'fallback';
        state.lastPriceSync = Date.now();
        emit();
        return { mode: 'fallback', ...res };
      }
    },
  };

  window.Store = Store;
})();
