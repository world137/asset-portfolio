/* eslint-disable */
/* TransactionModal.jsx — Add / edit a wallet transaction */

function calcCCInstallment(amount, months, annualRate) {
  const a = +amount, m = +months, r = +annualRate;
  if (!a || a <= 0 || !m || m <= 0) return null;
  const totalInterest  = a * (r / 100) * (m / 12);
  const monthlyPayment = (a + totalInterest) / m;
  return { monthlyPayment, totalInterest, totalPayable: a + totalInterest };
}

function TransactionModal({ open, transaction, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { accountId: '', date: today, amount: '', flow: 'expense', categoryId: '', note: '', toAccountId: '', fxRate: '' };
  const [f, setF]           = React.useState(blank);
  const [ccInst, setCcInst] = React.useState({ enabled: false, months: '12', rate: '0' });

  const wallet   = Store.getWallet();
  const accounts = wallet.accounts.filter(a => !a.archived);

  React.useEffect(() => {
    if (!open) return;
    setCcInst({ enabled: false, months: '12', rate: '0' });
    if (transaction) {
      setF({
        accountId:   transaction.accountId,
        date:        transaction.date,
        amount:      String(transaction.amount),
        flow:        transaction.flow,
        categoryId:  transaction.categoryId || '',
        note:        transaction.note || '',
        toAccountId: transaction.toAccountId || '',
        fxRate:      transaction.fxRate != null ? String(transaction.fxRate) : '',
      });
    } else {
      setF(s => ({ ...blank, accountId: accounts[0]?.id || '', date: today }));
    }
  }, [open, transaction]);

  const set    = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const setCI  = k => e => setCcInst(s => ({ ...s, [k]: e.target.value }));
  const editing = !!transaction;

  const fromAcc = accounts.find(a => a.id === f.accountId);
  const toAcc   = accounts.find(a => a.id === f.toAccountId);
  const isCross = f.flow === 'transfer' && fromAcc && toAcc && fromAcc.currency !== toAcc.currency;

  // Credit card expense detection
  const isCCExpense = fromAcc && fromAcc.type === 'credit_card' && f.flow === 'expense';
  const ccLimit     = isCCExpense ? (fromAcc.creditLimit || 0) : 0;
  const ccBalance   = isCCExpense ? Store.accountBalance(fromAcc.id) : 0;
  const ccAvail     = ccLimit > 0 ? Math.max(0, ccLimit + ccBalance) : 0;
  const overLimit   = isCCExpense && ccLimit > 0 && (+f.amount || 0) > ccAvail;

  const instPreview = isCCExpense && ccInst.enabled
    ? calcCCInstallment(f.amount, ccInst.months, ccInst.rate)
    : null;

  const valid = f.accountId && f.date && +f.amount > 0 &&
                (f.flow !== 'transfer' || f.toAccountId) &&
                f.accountId !== f.toAccountId &&
                !overLimit;

  const save = () => {
    if (!valid) return;
    const data = {
      accountId:   f.accountId,
      date:        f.date,
      amount:      +f.amount,
      flow:        f.flow,
      categoryId:  f.categoryId || null,
      note:        f.note.trim(),
      toAccountId: f.flow === 'transfer' ? (f.toAccountId || null) : null,
      fxRate:      isCross && f.fxRate !== '' ? +f.fxRate : null,
    };
    if (editing) {
      Store.updateTransaction(transaction.id, data);
    } else {
      Store.addTransaction(data);
      // Auto-create a debt record when expense is on a credit card
      if (isCCExpense) {
        Store.addDebt({
          direction:       'borrowed',
          counterparty:    fromAcc.name,
          amount:          +f.amount,
          currency:        fromAcc.currency,
          dateStart:       f.date,
          dateDue:         null,
          note:            f.note.trim() || `Charged to ${fromAcc.name}`,
          linkedAccountId: f.accountId,
          installment:     ccInst.enabled && +ccInst.months > 0 ? {
            months:       +ccInst.months,
            interestRate: +ccInst.rate,
            paidMonths:   0,
          } : null,
        });
      }
    }
    onClose();
  };

  const footer = (
    <React.Fragment>
      {editing && (
        <Button variant="ghost" style={{ marginRight: 'auto', color: 'var(--red-600)' }}
                onClick={() => { Store.deleteTransaction(transaction.id); onClose(); }}>
          Delete
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="accent" onClick={save} disabled={!valid}>
        {editing ? 'Save' : 'Add'}
      </Button>
    </React.Fragment>
  );

  return (
    <Modal open={open} onClose={onClose}
           title={editing ? 'Edit Transaction' : 'Add Transaction'}
           subtitle={editing ? null : 'Record income, expense, or transfer between accounts'}
           footer={footer} width={500}>
      <div className="mgrid">
        <div>
          <label className="flabel">Type</label>
          <div className="layoutseg" style={{ marginTop: 2 }}>
            {['income', 'expense', 'transfer'].map(fl => (
              <button key={fl} className={f.flow === fl ? 'on' : ''} onClick={() => setF(s => ({ ...s, flow: fl, categoryId: '' }))}>
                {fl.charAt(0).toUpperCase() + fl.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flabel">Date</label>
          <input className="input" type="date" value={f.date} onChange={set('date')} />
        </div>

        <div>
          <label className="flabel">{f.flow === 'transfer' ? 'From Account' : 'Account'}</label>
          <select className="input" value={f.accountId} onChange={set('accountId')}>
            <option value="">Select account…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flabel">Amount</label>
          <input className="input" type="number" min="0" step="any" placeholder="0.00"
                 value={f.amount} onChange={set('amount')} />
          {fromAcc && !overLimit && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
              in {fromAcc.currency}
              {isCCExpense && ccLimit > 0 && (
                <span> · Available credit: {window.fmtCcy(ccAvail, fromAcc.currency)}</span>
              )}
            </div>
          )}
          {overLimit && (
            <div style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 3, fontWeight: 600 }}>
              Exceeds available credit ({window.fmtCcy(ccAvail, fromAcc.currency)}). Reduce the amount or pay off the card first.
            </div>
          )}
        </div>

        {f.flow === 'transfer' && (
          <div>
            <label className="flabel">To Account</label>
            <select className="input" value={f.toAccountId} onChange={set('toAccountId')}>
              <option value="">Select account…</option>
              {accounts.filter(a => a.id !== f.accountId).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>
        )}

        {isCross && (
          <div>
            <label className="flabel">Exchange Rate (1 {fromAcc.currency} = ? {toAcc.currency})</label>
            <input className="input" type="number" min="0" step="any" placeholder="e.g. 0.029"
                   value={f.fxRate} onChange={set('fxRate')} />
          </div>
        )}

        {f.flow !== 'transfer' && (
          <div>
            <label className="flabel">Category</label>
            <select className="input" value={f.categoryId} onChange={set('categoryId')}>
              <option value="">— No category —</option>
              {(wallet.categories || []).filter(c => c.flow === f.flow).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className={f.flow === 'transfer' && !isCross ? 'full' : (f.flow !== 'transfer' ? 'full' : '')}>
          <label className="flabel">Note (optional)</label>
          <input className="input" placeholder="e.g. Lunch at Siam Paragon" value={f.note} onChange={set('note')} />
        </div>

        {/* ── Credit Card Installment Plan ──────────────────────────────────── */}
        {isCCExpense && !editing && (
          <React.Fragment>
            <div className="full" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={ccInst.enabled}
                       onChange={e => setCcInst(s => ({ ...s, enabled: e.target.checked }))} />
                <span style={{ fontWeight: 500, fontSize: 13 }}>Installment Plan</span>
              </label>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                This charge will be added to the Debts tab linked to {fromAcc.name}.
              </div>
            </div>

            {ccInst.enabled && (
              <React.Fragment>
                <div>
                  <label className="flabel">Number of Months</label>
                  <input className="input" type="number" min="1" max="120" step="1"
                         placeholder="12" value={ccInst.months} onChange={setCI('months')} />
                </div>
                <div>
                  <label className="flabel">Annual Interest Rate (%)</label>
                  <input className="input" type="number" min="0" step="0.01"
                         placeholder="0.00" value={ccInst.rate} onChange={setCI('rate')} />
                </div>
                {instPreview && (
                  <div className="full" style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ color: 'var(--fg-2)' }}>Monthly Payment</span>
                      <strong>{window.fmtCcy(instPreview.monthlyPayment, fromAcc.currency)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-3)', fontSize: 12 }}>
                      <span>Total Interest</span>
                      <span>{window.fmtCcy(instPreview.totalInterest, fromAcc.currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>
                      <span>Total Payable</span>
                      <span>{window.fmtCcy(instPreview.totalPayable, fromAcc.currency)}</span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </div>
    </Modal>
  );
}
