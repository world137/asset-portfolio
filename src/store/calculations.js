/* store/calculations.js — Pure derived-data functions.
   All functions receive live state/wallet by reference — no globals read directly.
   Exposed as window.StoreCalc for delegation from store.js. */
(function () {
  function lotMetrics(lot) {
    const cost   = lot.price * lot.qty;
    const value  = (lot.cur != null ? lot.cur : lot.price) * lot.qty;
    const profit = value - cost;
    const pct    = cost ? (profit / cost) * 100 : 0;
    return { cost, value, profit, pct };
  }

  function classByKey(k) { return window.ASSET_CLASSES.find(c => c.key === k); }

  function toDisplay(amount, nativeCcy, state) {
    const disp   = state.settings.displayCcy;
    if (nativeCcy === disp) return amount;
    const USDTHB = state.fx.USDTHB || window.SEED_FX_USDTHB;
    if (nativeCcy === 'USD' && disp === 'THB') return amount * USDTHB;
    if (nativeCcy === 'THB' && disp === 'USD') return amount / USDTHB;
    return amount;
  }

  function walletToDisplay(amount, nativeCcy, state) {
    const disp   = state.settings.displayCcy;
    if (nativeCcy === disp) return amount;
    const USDTHB = state.fx.USDTHB || window.SEED_FX_USDTHB;
    const JPYTHB = state.fx.JPYTHB || window.SEED_FX_JPYTHB;
    const KRWTHB = state.fx.KRWTHB || window.SEED_FX_KRWTHB;
    let inTHB;
    if      (nativeCcy === 'THB') inTHB = amount;
    else if (nativeCcy === 'USD') inTHB = amount * USDTHB;
    else if (nativeCcy === 'JPY') inTHB = amount * JPYTHB;
    else if (nativeCcy === 'KRW') inTHB = amount * KRWTHB;
    else                          inTHB = amount;
    if (disp === 'THB') return inTHB;
    if (disp === 'USD') return inTHB / USDTHB;
    return inTHB;
  }

  function defaultFxRate(fromCcy, toCcy, state) {
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

  function positions(classKey, state) {
    const cls  = classByKey(classKey);
    const lots = state.holdings[classKey] || [];
    const map  = new Map();
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

  function classTotals(classKey, state) {
    const cls = classByKey(classKey);
    let cost = 0, value = 0;
    for (const lot of (state.holdings[classKey] || [])) {
      const m = lotMetrics(lot);
      cost += m.cost; value += m.value;
    }
    const dCost  = toDisplay(cost, cls.ccy, state);
    const dValue = toDisplay(value, cls.ccy, state);
    return {
      key: classKey, label: cls.label, ccy: cls.ccy, color: window.CLASS_COLORS[classKey],
      costNative: cost, valueNative: value,
      cost: dCost, value: dValue, profit: dValue - dCost,
      pct: dCost ? ((dValue - dCost) / dCost) * 100 : 0,
      count: new Set((state.holdings[classKey] || []).map(l => l.name)).size,
    };
  }

  function grandTotals(state) {
    const classes = window.ASSET_CLASSES
      .map(c => classTotals(c.key, state))
      .filter(t => t.value > 0 || (state.holdings[t.key] || []).length);
    let cost = 0, value = 0;
    for (const t of classes) { cost += t.cost; value += t.value; }
    return { classes, cost, value, profit: value - cost, pct: cost ? ((value - cost) / cost) * 100 : 0 };
  }

  function sectorTotals(state) {
    const map = new Map();
    for (const cls of window.ASSET_CLASSES) {
      for (const p of positions(cls.key, state)) {
        const sec   = p.sector || '—';
        const v     = toDisplay(p.value, cls.ccy, state);
        const c     = toDisplay(p.cost,  cls.ccy, state);
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

  function tagTotals(state) {
    const map     = new Map();
    const allTags = state.tags || [];
    for (const cls of window.ASSET_CLASSES) {
      for (const pos of positions(cls.key, state)) {
        const key    = cls.key + ':' + pos.name;
        const tagIds = (state.holdingTags || {})[key] || [];
        if (!tagIds.length) continue;
        const v = toDisplay(pos.value, cls.ccy, state);
        const c = toDisplay(pos.cost,  cls.ccy, state);
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

  function grandTotalInTHB(state) {
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

  function salesSummary(state) {
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
  }

  function accBal(accountId, wallet) {
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
        b += (t.flow === 'income' || t.flow === 'neutral') ? t.amount : -t.amount;
      }
    }
    return b;
  }

  function debtRemainingAmount(d) {
    if (!d.installment) return d.amount;
    const { months, interestRate, paidMonths } = d.installment;
    const totalInterest  = d.amount * ((interestRate || 0) / 100) * (months / 12);
    const monthlyPayment = (d.amount + totalInterest) / months;
    return monthlyPayment * (months - (paidMonths || 0));
  }

  function monthlyFlow(year, month, wallet, state) {
    let income = 0, expense = 0;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    for (const t of wallet.transactions) {
      if (!t.date.startsWith(prefix)) continue;
      const acc    = wallet.accounts.find(a => a.id === t.accountId);
      const ccy    = acc ? acc.currency : 'THB';
      const inDisp = walletToDisplay(t.amount, ccy, state);
      if (t.flow === 'income')  income  += inDisp;
      if (t.flow === 'expense') expense += inDisp;
    }
    return { income, expense };
  }

  function debtSummary(wallet, state) {
    let totalLent = 0, totalBorrowed = 0, monthlyInstallment = 0;
    for (const d of wallet.debts) {
      if (d.settled) continue;
      const inDisp = walletToDisplay(debtRemainingAmount(d), d.currency, state);
      if (d.direction === 'lent')     totalLent     += inDisp;
      if (d.direction === 'borrowed') totalBorrowed += inDisp;
      if (d.installment) {
        const remaining = d.installment.months - (d.installment.paidMonths || 0);
        if (remaining > 0) {
          const ti = d.amount * ((d.installment.interestRate || 0) / 100) * (d.installment.months / 12);
          monthlyInstallment += walletToDisplay((d.amount + ti) / d.installment.months, d.currency, state);
        }
      }
    }
    return { totalLent, totalBorrowed, monthlyInstallment };
  }

  function netWorthSummary(state, wallet) {
    const portValue = grandTotals(state).value;
    let cashTotal = 0, creditDebt = 0, borrowedDebt = 0;
    for (const acc of wallet.accounts.filter(a => !a.archived)) {
      const bal = accBal(acc.id, wallet);
      if (acc.type === 'credit_card') {
        if (bal < 0) creditDebt += walletToDisplay(-bal, acc.currency, state);
      } else {
        if (bal > 0) cashTotal += walletToDisplay(bal, acc.currency, state);
      }
    }
    for (const d of wallet.debts) {
      if (!d.settled && d.direction === 'borrowed') {
        if (d.linkedAccountId) {
          const la = wallet.accounts.find(a => a.id === d.linkedAccountId);
          if (la && la.type === 'credit_card') continue;
        }
        borrowedDebt += walletToDisplay(debtRemainingAmount(d), d.currency, state);
      }
    }
    const totalAssets      = portValue + cashTotal;
    const totalLiabilities = creditDebt + borrowedDebt;
    return { portValue, cashTotal, creditDebt, borrowedDebt, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }

  function walletMonthlyData(numMonths, wallet, state) {
    numMonths   = numMonths || 6;
    const now   = new Date();
    return Array.from({ length: numMonths }, (_, i) => {
      const d      = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1 - i), 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let income = 0, expense = 0;
      for (const t of wallet.transactions) {
        if (!t.date.startsWith(prefix)) continue;
        const acc = wallet.accounts.find(a => a.id === t.accountId);
        const ccy = acc ? acc.currency : 'THB';
        const amt = walletToDisplay(t.amount, ccy, state);
        if (t.flow === 'income')  income  += amt;
        if (t.flow === 'expense') expense += amt;
      }
      const label = d.toLocaleString('en', { month: 'short' });
      return { month: prefix, label, income, expense };
    });
  }

  function walletCategoryData(monthPrefix, wallet, state) {
    const incMap = new Map(), expMap = new Map();
    for (const t of wallet.transactions) {
      if (!t.date.startsWith(monthPrefix)) continue;
      const acc = wallet.accounts.find(a => a.id === t.accountId);
      const ccy = acc ? acc.currency : 'THB';
      const amt = walletToDisplay(t.amount, ccy, state);
      const cat = wallet.categories.find(c => c.id === t.categoryId);
      const key = cat ? cat.name : 'Uncategorized';
      const col = cat ? (cat.color || '#6b7280') : '#6b7280';
      if (t.flow === 'income')  { const e = incMap.get(key) || { value: 0, color: col }; e.value += amt; incMap.set(key, e); }
      if (t.flow === 'expense') { const e = expMap.get(key) || { value: 0, color: col }; e.value += amt; expMap.set(key, e); }
    }
    const toSegs = m => [...m.entries()].map(([label, v]) => ({ label, value: v.value, color: v.color })).sort((a, b) => b.value - a.value);
    return { income: toSegs(incMap), expense: toSegs(expMap) };
  }

  window.StoreCalc = {
    lotMetrics, classByKey, toDisplay, walletToDisplay, defaultFxRate,
    positions, classTotals, grandTotals, sectorTotals, tagTotals,
    grandTotalInTHB, salesSummary,
    accBal, debtRemainingAmount,
    monthlyFlow, debtSummary, netWorthSummary, walletMonthlyData, walletCategoryData,
  };
})();
