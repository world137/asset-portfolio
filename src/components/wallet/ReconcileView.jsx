/* eslint-disable */
/* ReconcileView.jsx — Per-account reconciliation: match transactions to bank statement */

function ReconcileView() {
  useStore();
  const wallet    = Store.getWallet();
  const settings  = Store.settings();
  const sym       = window.ccySymbol(settings.displayCcy);
  const accounts  = (wallet.accounts || []).filter(a => !a.archived);

  const [accountId,    setAccountId]    = React.useState('');
  const [stmtBalance,  setStmtBalance]  = React.useState('');
  const [filterMonth,  setFilterMonth]  = React.useState('');

  const account = accounts.find(a => a.id === accountId);

  const transactions = React.useMemo(() => {
    if (!accountId) return [];
    return (wallet.transactions || [])
      .filter(t => (t.accountId === accountId || t.toAccountId === accountId))
      .filter(t => !filterMonth || t.date.startsWith(filterMonth))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [wallet.transactions, accountId, filterMonth]);

  const clearedTotal = React.useMemo(() => {
    if (!accountId) return 0;
    let total = 0;
    for (const t of transactions) {
      if (!t.cleared) continue;
      if (t.accountId === accountId) {
        if (t.flow === 'income')   total += t.amount;
        if (t.flow === 'expense')  total -= t.amount;
        if (t.flow === 'transfer') total -= t.amount;
      } else if (t.toAccountId === accountId) {
        total += t.fxRate ? t.amount * t.fxRate : t.amount;
      }
    }
    return total;
  }, [transactions, accountId]);

  const accountBalance = accountId ? Store.accountBalance(accountId) : 0;
  const stmtVal        = stmtBalance !== '' ? +stmtBalance : null;
  const difference     = stmtVal != null ? stmtVal - clearedTotal : null;

  const toggleCleared = (t) => {
    Store.updateTransaction(t.id, { ...t, cleared: !t.cleared });
  };

  const months = React.useMemo(() => {
    const set = new Set();
    for (const t of wallet.transactions || []) set.add(t.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [wallet.transactions]);

  const catMap = {};
  for (const c of wallet.categories || []) catMap[c.id] = c;
  const accMap = {};
  for (const a of accounts) accMap[a.id] = a;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Reconciliation</h1>
        <div className="t-small">Match your transactions to your bank statement balance</div>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          <div>
            <label className="flabel">Account</label>
            <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">— Select account —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flabel">Filter Month</label>
            <select className="input" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="">All months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="flabel">Statement Balance ({account ? account.currency : '—'})</label>
            <input className="input" type="number" step="any" placeholder="Enter your bank statement balance"
                   value={stmtBalance} onChange={e => setStmtBalance(e.target.value)} />
          </div>
        </div>

        {account && (
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 16px', minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Book Balance</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {window.fmtCcy(accountBalance, account.currency)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 16px', minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Cleared Total</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {window.fmtCcy(clearedTotal, account.currency)}
              </div>
            </div>
            {stmtVal != null && (
              <div style={{ background: Math.abs(difference) < 0.01 ? 'var(--green-600)18' : '#ef444418',
                            borderRadius: 10, padding: '10px 16px', minWidth: 140,
                            border: Math.abs(difference) < 0.01 ? '1.5px solid var(--green-600)44' : '1.5px solid #ef444444' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Difference</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)',
                              color: Math.abs(difference) < 0.01 ? 'var(--green-600)' : 'var(--red-600)' }}>
                  {difference >= 0 ? '+' : ''}{window.fmtCcy(difference, account.currency)}
                </div>
                {Math.abs(difference) < 0.01 && (
                  <div style={{ fontSize: 11, color: 'var(--green-600)', marginTop: 2, fontWeight: 600 }}>Balanced ✓</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!accountId ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">Select an account to begin reconciliation.</div>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">No transactions found for this account{filterMonth ? ' in ' + filterMonth : ''}.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-h">
            <div>
              <div className="t">Transactions</div>
              <div className="s">
                {transactions.filter(t => t.cleared).length} of {transactions.length} cleared
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ fontSize: 12, background: 'none', border: '1px solid var(--border-1)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--fg-2)' }}
                      onClick={() => { for (const t of transactions) if (!t.cleared) Store.updateTransaction(t.id, { ...t, cleared: true }); }}>
                Clear All
              </button>
              <button style={{ fontSize: 12, background: 'none', border: '1px solid var(--border-1)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--fg-2)' }}
                      onClick={() => { for (const t of transactions) if (t.cleared) Store.updateTransaction(t.id, { ...t, cleared: false }); }}>
                Uncheck All
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable">
              <thead><tr>
                <th style={{ width: 36 }}>✓</th>
                <th style={{ width: 90 }}>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="num">Amount</th>
              </tr></thead>
              <tbody>
                {transactions.map(t => {
                  const isIncoming = t.toAccountId === accountId;
                  const cat        = catMap[t.categoryId];
                  const sign       = (t.flow === 'income' || isIncoming) ? 1 : -1;
                  const dispAmt    = isIncoming && t.fxRate ? t.amount * t.fxRate : t.amount;
                  return (
                    <tr key={t.id} onClick={() => toggleCleared(t)} style={{ cursor: 'pointer', opacity: t.cleared ? 1 : 0.6, background: t.cleared ? 'var(--green-600)06' : '' }}>
                      <td>
                        <div style={{ width: 20, height: 20, borderRadius: 5, border: '2px solid ' + (t.cleared ? 'var(--green-600)' : 'var(--border-2)'),
                                      background: t.cleared ? 'var(--green-600)' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                          {t.cleared && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t.date}</td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{t.note || (t.flow === 'transfer' ? 'Transfer' : cat ? cat.name : '—')}</div>
                        {t.splitGroupId && <span style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-3)', borderRadius: 4, padding: '1px 5px' }}>Split</span>}
                        {t.tags && t.tags.length > 0 && (
                          <div style={{ marginTop: 2 }}>
                            {t.tags.map(tag => (
                              <span key={tag} style={{ fontSize: 10, background: 'var(--accent)22', color: 'var(--accent)', borderRadius: 10, padding: '1px 6px', marginRight: 3 }}>#{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{cat ? cat.name : t.flow === 'transfer' ? 'Transfer' : '—'}</td>
                      <td className={'num ' + (sign > 0 ? 'up' : 'down')} style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {sign > 0 ? '+' : '−'}{window.fmtCcy(dispAmt, account.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
