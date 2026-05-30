/* eslint-disable */
/* TransactionLog.jsx — Transaction list with filters and add/edit modal */

function TransactionLog() {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();

  const [modalOpen,   setModalOpen]   = React.useState(false);
  const [editTxn,     setEditTxn]     = React.useState(null);
  const [catOpen,     setCatOpen]     = React.useState(false);
  const [filterFlow,    setFilterFlow]    = React.useState('all');
  const [filterAccount, setFilterAccount] = React.useState('all');
  const [filterMonth,   setFilterMonth]   = React.useState('');

  const accounts   = wallet.accounts;
  const categories = wallet.categories;

  const accMap = {};
  for (const a of accounts) accMap[a.id] = a;
  const catMap = {};
  for (const c of categories) catMap[c.id] = c;

  // Determine available months from transactions
  const months = [...new Set(wallet.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();

  // Current month as default for filter display
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filtered = wallet.transactions.filter(t => {
    if (filterFlow !== 'all' && t.flow !== filterFlow) return false;
    if (filterAccount !== 'all' && t.accountId !== filterAccount && t.toAccountId !== filterAccount) return false;
    if (filterMonth && !t.date.startsWith(filterMonth)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Monthly summary of filtered set
  const summary = filtered.reduce((acc, t) => {
    const a = accMap[t.accountId];
    const ccy = a ? a.currency : 'THB';
    const inDisp = Store.walletToDisplay(t.amount, ccy);
    if (t.flow === 'income')   acc.income  += inDisp;
    if (t.flow === 'expense')  acc.expense += inDisp;
    return acc;
  }, { income: 0, expense: 0 });

  const net = summary.income - summary.expense;

  const FLOW_COLORS = { income: 'var(--green-600)', expense: 'var(--red-600)', transfer: 'var(--fg-2)' };
  const FLOW_SIGN   = { income: '+', expense: '−', transfer: '→' };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Transactions</h1>
          <div className="t-small">{filtered.length} transactions shown</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon="sliders" onClick={() => setCatOpen(true)}>Categories</Button>
          <Button variant="accent" icon="plus" onClick={() => { setEditTxn(null); setModalOpen(true); }}>
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi accent">
          <div className="lab">Income</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(summary.income)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Expense</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(summary.expense)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Net</div>
          <div className={'big ' + (net >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{window.fmtBig(Math.abs(net))}
          </div>
          <div className={'delta ' + (net >= 0 ? 'up' : 'down')}>{net >= 0 ? 'Surplus' : 'Deficit'}</div>
        </div>
        <div className="kpi">
          <div className="lab">Transactions</div>
          <div className="big">{filtered.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row" style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexShrink: 0, maxWidth: '100%' }}>
          <div className="layoutseg" style={{ whiteSpace: 'nowrap' }}>
            {['all', 'income', 'expense', 'transfer'].map(fl => (
              <button key={fl} className={filterFlow === fl ? 'on' : ''} onClick={() => setFilterFlow(fl)}>
                {fl.charAt(0).toUpperCase() + fl.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <select className="input" style={{ height: 32, fontSize: 12, padding: '0 8px', minWidth: 120, flex: '1 1 120px' }}
                value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input" style={{ height: 32, fontSize: 12, padding: '0 8px', minWidth: 100, flex: '1 1 100px' }}
                value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All time</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="ptable">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Date</th>
                <th>Account</th>
                <th>Category</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty">No transactions found.</div></td></tr>
              )}
              {filtered.map(t => {
                const acc  = accMap[t.accountId];
                const cat  = catMap[t.categoryId];
                const toAc = accMap[t.toAccountId];
                const color = FLOW_COLORS[t.flow];
                const sign  = FLOW_SIGN[t.flow];
                return (
                  <tr key={t.id} onClick={() => { setEditTxn(t); setModalOpen(true); }} style={{ cursor: 'pointer' }}>
                    <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>{t.date}</td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{acc ? acc.name : '—'}</div>
                      {t.flow === 'transfer' && toAc && (
                        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>→ {toAc.name}</div>
                      )}
                    </td>
                    <td>
                      {cat ? (
                        <span className="sectorchip" style={{ background: (cat.color || '#6b7280') + '22', color: cat.color || 'var(--fg-2)' }}>
                          {cat.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>
                          {t.flow === 'transfer' ? 'Transfer' : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--fg-2)', fontSize: 12 }}>{t.note || ''}</td>
                    <td className="num" style={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {sign}{window.fmtCcy(t.amount, acc ? acc.currency : 'THB')}
                    </td>
                    <td className="num">
                      <Button variant="ghost" size="sm" icon="edit" onClick={e => { e.stopPropagation(); setEditTxn(t); setModalOpen(true); }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionModal open={modalOpen} transaction={editTxn}
                        onClose={() => { setModalOpen(false); setEditTxn(null); }} />
      <CategoryModal open={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  );
}
