/* store/wallet-mutations.js — Wallet CRUD: accounts, categories, transactions, debts, bills, savings goals, snapshots.
   Exposed as window.WalletMut.  store.js calls WalletMut.init(ctx) once. */
(function () {
  let _ctx = null;

  // Build the correct transaction(s) for a debt payment or outstanding receipt.
  function _debtPayTx(debt, accountId, amount, date, note) {
    const { uid, wallet } = _ctx;
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
      if (!payingAcc || payingAcc.type === 'credit_card') return [];
      return [{ id: uid(), accountId, date, amount, flow: 'transfer', ...txBase, toAccountId: linkedAccId }];
    }
    // Non-CC-linked borrowed debt
    if (payingAcc && payingAcc.type === 'credit_card') {
      return [{ id: uid(), accountId, date, amount, flow: 'income', ...txBase }];
    }
    return [{ id: uid(), accountId, date, amount, flow: 'expense', ...txBase }];
  }

  // ── Accounts ──────────────────────────────────────────────────────────────────
  function addAccount(data) {
    const { wallet, uid, notifySubs, scheduleWalletSave } = _ctx;
    wallet.accounts.push({
      id: uid(), name: data.name, type: data.type || 'bank',
      currency: data.currency || 'THB', color: data.color || null,
      initialBal: +data.initialBal || 0,
      creditLimit: data.creditLimit != null ? +data.creditLimit : null,
      openingFxRateTHB: data.openingFxRateTHB != null ? +data.openingFxRateTHB : null,
      sortOrder: wallet.accounts.length, archived: false,
    });
    notifySubs(); scheduleWalletSave();
  }

  function updateAccount(id, patch) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    const i = wallet.accounts.findIndex(a => a.id === id);
    if (i < 0) return;
    wallet.accounts[i] = { ...wallet.accounts[i], ...patch };
    notifySubs(); scheduleWalletSave();
  }

  function deleteAccount(id) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.accounts     = wallet.accounts.filter(a => a.id !== id);
    wallet.transactions = wallet.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
    notifySubs(); scheduleWalletSave();
  }

  // ── Categories ────────────────────────────────────────────────────────────────
  function addCategory(data) {
    const { wallet, uid, notifySubs, scheduleWalletSave } = _ctx;
    wallet.categories.push({ id: uid(), name: data.name, flow: data.flow, icon: data.icon || null, color: data.color || null, budget: data.budget || null });
    notifySubs(); scheduleWalletSave();
  }

  function updateCategory(id, patch) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    const i = wallet.categories.findIndex(c => c.id === id);
    if (i < 0) return;
    wallet.categories[i] = { ...wallet.categories[i], ...patch };
    notifySubs(); scheduleWalletSave();
  }

  function deleteCategory(id) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.categories = wallet.categories.filter(c => c.id !== id);
    notifySubs(); scheduleWalletSave();
  }

  // ── Transactions ──────────────────────────────────────────────────────────────
  function addTransaction(data) {
    const { wallet, uid, notifySubs, scheduleWalletSave } = _ctx;
    wallet.transactions.push({
      id: uid(), accountId: data.accountId, date: data.date,
      amount: +data.amount, flow: data.flow,
      categoryId: data.categoryId || null,
      note: data.note || '',
      toAccountId: data.toAccountId || null,
      fxRate: data.fxRate != null ? +data.fxRate : null,
      tags: data.tags || [],
    });
    notifySubs(); scheduleWalletSave();
  }

  function updateTransaction(id, patch) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    const i = wallet.transactions.findIndex(t => t.id === id);
    if (i < 0) return;
    const updated = { ...wallet.transactions[i], ...patch };
    wallet.transactions = [...wallet.transactions.slice(0, i), updated, ...wallet.transactions.slice(i + 1)];
    notifySubs(); scheduleWalletSave();
  }

  function deleteTransaction(id) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.transactions = wallet.transactions.filter(t => t.id !== id);
    notifySubs(); scheduleWalletSave();
  }

  // ── Debts ─────────────────────────────────────────────────────────────────────
  function addDebt(data) {
    const { wallet, uid, notifySubs, scheduleWalletSave } = _ctx;
    wallet.debts.push({
      id: uid(), direction: data.direction, counterparty: data.counterparty,
      amount: +data.amount, currency: data.currency || 'THB',
      dateStart: data.dateStart, dateDue: data.dateDue || null,
      note: data.note || '', settled: false, settledDate: null,
      installment: data.installment || null,
      linkedAccountId: data.linkedAccountId || null,
    });
    notifySubs(); scheduleWalletSave();
  }

  function updateDebt(id, patch) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    const i = wallet.debts.findIndex(d => d.id === id);
    if (i < 0) return;
    wallet.debts[i] = { ...wallet.debts[i], ...patch };
    notifySubs(); scheduleWalletSave();
  }

  function settleDebt(id, settledDate, accountId) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    const i = wallet.debts.findIndex(d => d.id === id);
    if (i < 0) return;
    const debt         = wallet.debts[i];
    const resolvedDate = settledDate || new Date().toISOString().slice(0, 10);
    wallet.debts[i]    = { ...debt, settled: true, settledDate: resolvedDate };
    if (accountId) {
      let remaining = window.StoreCalc.debtRemainingAmount(debt);
      if (debt.direction === 'borrowed' && debt.linkedAccountId) {
        const la = wallet.accounts.find(a => a.id === debt.linkedAccountId);
        if (la && la.type === 'credit_card') {
          remaining = Math.min(remaining, Math.max(0, -window.StoreCalc.accBal(debt.linkedAccountId, wallet)));
        }
      }
      if (remaining > 0) {
        const tx = _debtPayTx(debt, accountId, remaining, resolvedDate,
          debt.direction === 'borrowed' ? `Debt settled: ${debt.counterparty}` : `Outstanding received: ${debt.counterparty}`);
        tx.forEach(t => wallet.transactions.push(t));
      }
    }
    notifySubs(); scheduleWalletSave();
  }

  function deleteDebt(id) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.debts = wallet.debts.filter(d => d.id !== id);
    notifySubs(); scheduleWalletSave();
  }

  function payInstallmentMonth(id, accountId, date) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    const i = wallet.debts.findIndex(d => d.id === id);
    if (i < 0) return;
    const debt = wallet.debts[i];
    if (!debt.installment) return;
    const paid         = (debt.installment.paidMonths || 0) + 1;
    const done         = paid >= debt.installment.months;
    const resolvedDate = date || new Date().toISOString().slice(0, 10);
    wallet.debts[i] = {
      ...debt,
      installment: { ...debt.installment, paidMonths: paid },
      settled:     done || debt.settled,
      settledDate: done && !debt.settled ? resolvedDate : debt.settledDate,
    };
    if (accountId) {
      const ti             = debt.amount * ((debt.installment.interestRate || 0) / 100) * (debt.installment.months / 12);
      const monthlyPayment = (debt.amount + ti) / debt.installment.months;
      const label          = debt.direction === 'borrowed'
        ? `Debt payment: ${debt.counterparty} (${paid}/${debt.installment.months})`
        : `Outstanding received: ${debt.counterparty} (${paid}/${debt.installment.months})`;
      if (monthlyPayment > 0) {
        const tx = _debtPayTx(debt, accountId, monthlyPayment, resolvedDate, label);
        tx.forEach(t => wallet.transactions.push(t));
      }
    }
    notifySubs(); scheduleWalletSave();
  }

  // ── Bills ─────────────────────────────────────────────────────────────────────
  function addBill(data) {
    const { wallet, uid, notifySubs, scheduleWalletSave } = _ctx;
    wallet.bills = wallet.bills || [];
    wallet.bills.push({ id: uid(), name: data.name, amount: +data.amount || 0, currency: data.currency || 'THB',
      dueDay: +data.dueDay || 1, categoryId: data.categoryId || null, note: data.note || '', active: true });
    notifySubs(); scheduleWalletSave();
  }

  function updateBill(id, patch) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.bills = wallet.bills || [];
    const i = wallet.bills.findIndex(b => b.id === id);
    if (i < 0) return;
    wallet.bills[i] = { ...wallet.bills[i], ...patch };
    notifySubs(); scheduleWalletSave();
  }

  function deleteBill(id) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.bills = (wallet.bills || []).filter(b => b.id !== id);
    notifySubs(); scheduleWalletSave();
  }

  // ── Savings goals ─────────────────────────────────────────────────────────────
  function addSavingsGoal(data) {
    const { wallet, uid, notifySubs, scheduleWalletSave } = _ctx;
    wallet.savingsGoals = wallet.savingsGoals || [];
    wallet.savingsGoals.push({ id: uid(), name: data.name, targetAmount: +data.targetAmount || 0,
      currency: data.currency || 'THB', targetDate: data.targetDate || null,
      linkedAccountId: data.linkedAccountId || null, note: data.note || '', emoji: data.emoji || '🎯' });
    notifySubs(); scheduleWalletSave();
  }

  function updateSavingsGoal(id, patch) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.savingsGoals = wallet.savingsGoals || [];
    const i = wallet.savingsGoals.findIndex(g => g.id === id);
    if (i < 0) return;
    wallet.savingsGoals[i] = { ...wallet.savingsGoals[i], ...patch };
    notifySubs(); scheduleWalletSave();
  }

  function deleteSavingsGoal(id) {
    const { wallet, notifySubs, scheduleWalletSave } = _ctx;
    wallet.savingsGoals = (wallet.savingsGoals || []).filter(g => g.id !== id);
    notifySubs(); scheduleWalletSave();
  }

  // ── Wallet snapshots ──────────────────────────────────────────────────────────
  function takeWalletSnapshot(netWorthSummaryFn) {
    const { wallet, scheduleWalletSave } = _ctx;
    const today = new Date().toISOString().slice(0, 10);
    wallet.walletSnapshots = wallet.walletSnapshots || [];
    const nw   = netWorthSummaryFn();
    const snap = { date: today, netWorth: nw.netWorth, cash: nw.cashTotal, liabilities: nw.totalLiabilities };
    const idx  = wallet.walletSnapshots.findIndex(s => s.date === today);
    if (idx >= 0) wallet.walletSnapshots[idx] = snap;
    else wallet.walletSnapshots.push(snap);
    if (wallet.walletSnapshots.length > 365) wallet.walletSnapshots = wallet.walletSnapshots.slice(-365);
    scheduleWalletSave();
  }

  // ── Bills helper ──────────────────────────────────────────────────────────────
  function getBillsDueSoon(withinDays) {
    const { wallet } = _ctx;
    const bills = wallet.bills || [];
    const today = new Date();
    const dd    = withinDays || 3;
    return bills.filter(b => {
      if (!b.active) return false;
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), b.dueDay);
      const diff      = (thisMonth - today) / 86400000;
      return diff >= 0 && diff <= dd;
    });
  }

  function init(ctx) { _ctx = ctx; }

  window.WalletMut = {
    init,
    addAccount, updateAccount, deleteAccount,
    addCategory, updateCategory, deleteCategory,
    addTransaction, updateTransaction, deleteTransaction,
    addDebt, updateDebt, settleDebt, deleteDebt, payInstallmentMonth,
    addBill, updateBill, deleteBill,
    addSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
    takeWalletSnapshot, getBillsDueSoon,
  };
})();
