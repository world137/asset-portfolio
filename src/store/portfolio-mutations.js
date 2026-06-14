/* store/portfolio-mutations.js — Holdings, tags, goals, dividends, eco events, alerts, notes.
   All functions receive (state, wallet, uid, emit, linkWalletTxn) via PortfolioMut.init(ctx).
   Exposed as window.PortfolioMut. */
(function () {
  let _ctx = null;

  // ── Holdings ─────────────────────────────────────────────────────────────────
  function addLot(classKey, lot, walletDeduction) {
    const { state, wallet, uid, emit, linkWalletTxn } = _ctx;
    state.holdings[classKey] = state.holdings[classKey] || [];
    state.holdings[classKey].push({
      id: uid(), name: lot.name, type: lot.type || undefined,
      price: +lot.price, qty: +lot.qty,
      cur: lot.cur != null && lot.cur !== '' ? +lot.cur : +lot.price,
    });
    if (lot.sector) state.sectors[classKey + ':' + lot.name] = lot.sector;
    if (walletDeduction && walletDeduction.accountId) {
      const cls  = window.ASSET_CLASSES.find(c => c.key === classKey);
      const cost = +lot.price * +lot.qty;
      linkWalletTxn({
        accountId: walletDeduction.accountId,
        assetCcy:  cls ? cls.ccy : 'THB',
        amount:    cost,
        flow:      'expense',
        fxRate:    walletDeduction.exchangeRate || null,
        note:      `Buy ${window.fmtQty ? window.fmtQty(+lot.qty) : lot.qty} ${lot.name}`,
      });
    }
    emit();
  }

  function updateLot(classKey, id, patch) {
    const { state, emit } = _ctx;
    const arr = state.holdings[classKey] || [];
    const i   = arr.findIndex(l => l.id === id);
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
  }

  function deleteLot(classKey, id) {
    const { state, emit } = _ctx;
    state.holdings[classKey] = (state.holdings[classKey] || []).filter(l => l.id !== id);
    emit();
  }

  function applyParValueReduction(classKey, name, oldPar, newPar) {
    const { state, emit } = _ctx;
    if (!oldPar || !newPar || oldPar <= 0 || newPar <= 0) return;
    const ratio = newPar / oldPar;
    (state.holdings[classKey] || []).forEach(l => {
      if (l.name !== name) return;
      l.qty   = +(l.qty   * ratio).toFixed(8);
      l.price = +(l.price / ratio).toFixed(8);
      if (l.cur != null) l.cur = +(l.cur / ratio).toFixed(8);
    });
    emit();
  }

  function setCurrentPrice(classKey, name, cur) {
    const { state, emit } = _ctx;
    (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +cur; });
    emit();
  }

  function setSector(classKey, name, sector) {
    const { state, emit } = _ctx;
    state.sectors[classKey + ':' + name] = sector;
    emit();
  }

  // ── Sales (FIFO lot reduction) ────────────────────────────────────────────────
  function recordSale(classKey, { date, name, ccy, buyPrice, sellPrice, qty }, walletCredit) {
    const { state, uid, emit, linkWalletTxn } = _ctx;
    const cost        = +buyPrice * +qty;
    const proceeds    = +sellPrice * +qty;
    const realizedPnl = proceeds - cost;
    const pnlPct      = cost ? (realizedPnl / cost) * 100 : 0;
    state.sales = state.sales || [];
    state.sales.push({ id: uid(), date, classKey, name, ccy,
      buyPrice: +buyPrice, sellPrice: +sellPrice, qty: +qty,
      cost, proceeds, realizedPnl, pnlPct });
    if (walletCredit && walletCredit.accountId) {
      const fxRate = walletCredit.exchangeRate || null;
      if (realizedPnl === 0) {
        linkWalletTxn({ accountId: walletCredit.accountId, assetCcy: ccy || 'THB', amount: proceeds, flow: 'neutral', fxRate, note: `Principal — ${name}` });
      } else if (realizedPnl > 0) {
        linkWalletTxn({ accountId: walletCredit.accountId, assetCcy: ccy || 'THB', amount: cost,        flow: 'neutral', fxRate, note: `Principal — ${name}` });
        linkWalletTxn({ accountId: walletCredit.accountId, assetCcy: ccy || 'THB', amount: realizedPnl, flow: 'income',  fxRate, note: `Profit — ${name}` });
      } else {
        linkWalletTxn({ accountId: walletCredit.accountId, assetCcy: ccy || 'THB', amount: proceeds,              flow: 'neutral', fxRate, note: `Principal — ${name}` });
        linkWalletTxn({ accountId: walletCredit.accountId, assetCcy: ccy || 'THB', amount: Math.abs(realizedPnl), flow: 'expense', fxRate, note: `Loss — ${name}` });
      }
    }
    // FIFO lot reduction
    let toDeduct = +qty;
    const matchingLots = (state.holdings[classKey] || [])
      .filter(l => l.name === name)
      .sort((a, b) => (a.boughtAt || '0000-00-00').localeCompare(b.boughtAt || '0000-00-00'));
    for (const lot of matchingLots) {
      if (toDeduct <= 0) break;
      if (lot.qty <= toDeduct) {
        toDeduct -= lot.qty;
        state.holdings[classKey] = state.holdings[classKey].filter(l => l.id !== lot.id);
      } else {
        lot.qty = +(lot.qty - toDeduct).toFixed(8);
        toDeduct = 0;
      }
    }
    emit();
  }

  function deleteSale(id) {
    const { state, emit } = _ctx;
    state.sales = (state.sales || []).filter(s => s.id !== id);
    emit();
  }

  // ── Tags ──────────────────────────────────────────────────────────────────────
  function addTag(name, color) {
    const { state, uid, emit } = _ctx;
    const id = uid();
    state.tags = state.tags || [];
    state.tags.push({ id, name: name.trim(), color: color || '#6b7280' });
    emit();
    return id;
  }

  function deleteTag(id) {
    const { state, emit } = _ctx;
    state.tags = (state.tags || []).filter(t => t.id !== id);
    const ht = state.holdingTags || {};
    for (const key of Object.keys(ht)) {
      ht[key] = ht[key].filter(tid => tid !== id);
      if (!ht[key].length) delete ht[key];
    }
    emit();
  }

  function updateTag(id, patch) {
    const { state, emit } = _ctx;
    const tags = state.tags || [];
    const i    = tags.findIndex(t => t.id === id);
    if (i < 0) return;
    tags[i] = { ...tags[i], ...patch };
    emit();
  }

  function setHoldingTags(key, tagIds) {
    const { state, emit } = _ctx;
    state.holdingTags = state.holdingTags || {};
    if (!tagIds || !tagIds.length) {
      delete state.holdingTags[key];
    } else {
      state.holdingTags[key] = tagIds;
    }
    emit();
  }

  // ── Goals ─────────────────────────────────────────────────────────────────────
  function addGoal(data) {
    const { state, uid, emit } = _ctx;
    state.goals = state.goals || [];
    state.goals.push({
      id: uid(), name: data.name, targetAmount: +data.targetAmount,
      targetDate: data.targetDate || null, note: data.note || '',
      emoji: data.emoji || '🎯', createdAt: new Date().toISOString().slice(0, 10),
    });
    emit();
  }

  function updateGoal(id, patch) {
    const { state, emit } = _ctx;
    const i = (state.goals || []).findIndex(g => g.id === id);
    if (i < 0) return;
    state.goals[i] = { ...state.goals[i], ...patch };
    emit();
  }

  function deleteGoal(id) {
    const { state, emit } = _ctx;
    state.goals = (state.goals || []).filter(g => g.id !== id);
    emit();
  }

  // ── Dividends ─────────────────────────────────────────────────────────────────
  function addDividend(data) {
    const { state, uid, emit } = _ctx;
    state.dividends = state.dividends || [];
    state.dividends.push({
      id: uid(), classKey: data.classKey, name: data.name,
      exDate: data.exDate || null, payDate: data.payDate,
      amountPerShare: data.amountPerShare ? +data.amountPerShare : null,
      totalAmount: data.totalAmount ? +data.totalAmount : null,
      currency: data.currency || 'THB', note: data.note || '',
    });
    emit();
  }

  function updateDividend(id, patch) {
    const { state, emit } = _ctx;
    const i = (state.dividends || []).findIndex(d => d.id === id);
    if (i < 0) return;
    state.dividends[i] = { ...state.dividends[i], ...patch };
    emit();
  }

  function deleteDividend(id) {
    const { state, emit } = _ctx;
    state.dividends = (state.dividends || []).filter(d => d.id !== id);
    emit();
  }

  // ── Economic events ───────────────────────────────────────────────────────────
  function addEcoEvent(data) {
    const { state, uid, emit } = _ctx;
    state.ecoEvents = [...(state.ecoEvents || []), { ...data, id: uid() }];
    emit();
  }

  function updateEcoEvent(id, patch) {
    const { state, emit } = _ctx;
    state.ecoEvents = (state.ecoEvents || []).map(e => e.id === id ? { ...e, ...patch } : e);
    emit();
  }

  function deleteEcoEvent(id) {
    const { state, emit } = _ctx;
    state.ecoEvents = (state.ecoEvents || []).filter(e => e.id !== id);
    emit();
  }

  // ── Price alerts ───────────────────────────────────────────────────────────────
  function addPriceAlert(data) {
    const { state, uid, emit } = _ctx;
    state.priceAlerts = state.priceAlerts || [];
    state.priceAlerts.push({
      id: uid(), classKey: data.classKey, name: data.name,
      condition: data.condition, price: +data.price,
      note: data.note || '', triggered: false,
    });
    emit();
  }

  function deletePriceAlert(id) {
    const { state, emit } = _ctx;
    state.priceAlerts = (state.priceAlerts || []).filter(a => a.id !== id);
    emit();
  }

  function markAlertTriggered(id) {
    const { state, emit } = _ctx;
    const i = (state.priceAlerts || []).findIndex(a => a.id === id);
    if (i >= 0) { state.priceAlerts[i] = { ...state.priceAlerts[i], triggered: true }; emit(); }
  }

  // ── Holding notes ─────────────────────────────────────────────────────────────
  function setHoldingNote(classKey, name, note) {
    const { state, emit } = _ctx;
    state.holdingNotes = state.holdingNotes || {};
    const key = classKey + ':' + name;
    if (!note || !note.trim()) {
      delete state.holdingNotes[key];
    } else {
      state.holdingNotes[key] = note.trim();
    }
    emit();
  }

  // ── Target allocation ─────────────────────────────────────────────────────────
  function setTargetAllocation(classKey, pct) {
    const { state, emit } = _ctx;
    state.targetAllocation = state.targetAllocation || {};
    state.targetAllocation[classKey] = +pct;
    emit();
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────────
  function takeSnapshot() {
    const { state } = _ctx;
    const today = new Date().toISOString().slice(0, 10);
    const value = window.StoreCalc.grandTotalInTHB(state);
    if (value <= 0) return;
    const rate = state.fx.USDTHB || window.SEED_FX_USDTHB;
    const snap = { date: today, value };
    for (const cls of window.ASSET_CLASSES) {
      let v = 0;
      for (const lot of (state.holdings[cls.key] || [])) {
        const m = window.StoreCalc.lotMetrics(lot);
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

  function init(ctx) { _ctx = ctx; }

  window.PortfolioMut = {
    init,
    addLot, updateLot, deleteLot, applyParValueReduction, setCurrentPrice, setSector,
    recordSale, deleteSale,
    addTag, deleteTag, updateTag, setHoldingTags,
    addGoal, updateGoal, deleteGoal,
    addDividend, updateDividend, deleteDividend,
    addEcoEvent, updateEcoEvent, deleteEcoEvent,
    addPriceAlert, deletePriceAlert, markAlertTriggered,
    setHoldingNote,
    setTargetAllocation,
    takeSnapshot,
  };
})();
