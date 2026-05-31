/* eslint-disable */
/* TransactionModal.jsx — Add / edit a wallet transaction */

function TransactionModal({ open, transaction, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { accountId: '', date: today, amount: '', flow: 'expense', categoryId: '', note: '', toAccountId: '', fxRate: '' };
  const [f, setF] = React.useState(blank);

  const wallet   = Store.getWallet();
  const accounts = wallet.accounts.filter(a => !a.archived);

  React.useEffect(() => {
    if (!open) return;
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

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const editing = !!transaction;

  const fromAcc    = accounts.find(a => a.id === f.accountId);
  const toAcc      = accounts.find(a => a.id === f.toAccountId);
  const isCross    = f.flow === 'transfer' && fromAcc && toAcc && fromAcc.currency !== toAcc.currency;
  const categories = (wallet.categories || []).filter(c => c.flow === f.flow || f.flow === 'transfer');

  // Credit limit guard: for expense on a credit card, block if amount exceeds available credit.
  const isCCExpense = fromAcc && fromAcc.type === 'credit_card' && f.flow === 'expense';
  const ccLimit     = isCCExpense ? (fromAcc.creditLimit || 0) : 0;
  const ccBalance   = isCCExpense ? Store.accountBalance(fromAcc.id) : 0;
  // Balance is negative when in debt; available = limit − |debt| = limit + balance
  const ccAvail     = ccLimit > 0 ? Math.max(0, ccLimit + ccBalance) : 0;
  const overLimit   = isCCExpense && ccLimit > 0 && (+f.amount || 0) > ccAvail;

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
    if (editing) Store.updateTransaction(transaction.id, data);
    else         Store.addTransaction(data);
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
      </div>
    </Modal>
  );
}
