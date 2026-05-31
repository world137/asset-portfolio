/* eslint-disable */
/* WalletOverview.jsx — Accounts page: account cards, balances, monthly summary */

function AccountCard({ account, balance, onEdit }) {
  const TYPE_LABELS = { bank: 'Bank', cash: 'Cash', credit_card: 'Credit Card', ewallet: 'E-Wallet' };
  const color   = account.color || '#5a6677';
  const isCC    = account.type === 'credit_card';
  // balance < 0 means you owe (spent more than paid). ccDebt is the positive debt amount.
  const ccDebt  = isCC ? Math.max(0, -balance) : 0;
  const ccAvail = isCC && account.creditLimit ? Math.max(0, account.creditLimit - ccDebt) : 0;
  const utilPct = isCC && account.creditLimit ? Math.min((ccDebt / account.creditLimit) * 100, 100) : 0;
  const balColor = balance < 0 ? 'var(--red-600)' : (balance === 0 ? 'var(--fg-3)' : 'var(--fg-1)');

  // Format signed balance: negative shown with − prefix
  const signedBalance = balance < 0
    ? '−' + window.fmtCcy(-balance, account.currency)
    : window.fmtCcy(balance, account.currency);

  return (
    <div className="card" style={{ borderTop: '3px solid ' + color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px 6px' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-1)' }}>{account.name}</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="sectorchip" style={{ background: color + '22', color, fontSize: 10 }}>
              {TYPE_LABELS[account.type] || account.type}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{account.currency}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="edit" onClick={onEdit} />
      </div>
      <div style={{ padding: '4px 16px 14px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: balColor, fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
          {signedBalance}
        </div>
        {isCC && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
            {account.creditLimit
              ? `Available: ${window.fmtCcy(ccAvail, account.currency)}`
              : (ccDebt > 0 ? 'Debt owed' : 'No balance')}
          </div>
        )}
        {isCC && account.creditLimit ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>
              <span>Used</span>
              <span>{window.fmtCcy(account.creditLimit, account.currency)} limit</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-inset,var(--bg-app))', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: utilPct + '%', height: '100%', background: utilPct > 80 ? 'var(--red-600)' : color, borderRadius: 2, transition: 'width .3s' }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WalletOverview() {
  useStore();
  const settings  = Store.settings();
  const sym       = window.ccySymbol(settings.displayCcy);
  const wallet    = Store.getWallet();
  const [addOpen, setAddOpen]     = React.useState(false);
  const [editAcc,  setEditAcc]    = React.useState(null);

  const accounts = wallet.accounts.filter(a => !a.archived);

  const accountsWithBal = accounts.map(a => ({
    ...a,
    balance:        Store.accountBalance(a.id),
    balanceDisplay: Store.walletToDisplay(Store.accountBalance(a.id), a.currency),
  }));

  const totalDisplay = accountsWithBal.reduce((s, a) => s + a.balanceDisplay, 0);

  const now      = new Date();
  const monthly  = Store.monthlyFlow(now.getFullYear(), now.getMonth() + 1);
  const netFlow  = monthly.income - monthly.expense;

  // Split accounts by type for display order
  const regularAccounts = accountsWithBal.filter(a => a.type !== 'credit_card');
  const creditCards     = accountsWithBal.filter(a => a.type === 'credit_card');

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Accounts</h1>
          <div className="t-small">{accounts.length} accounts · totals in {settings.displayCcy}</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => setAddOpen(true)}>Add Account</Button>
      </div>

      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi accent">
          <div className="lab">Total Balance</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totalDisplay)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{accounts.length} accounts</div>
        </div>
        <div className="kpi">
          <div className="lab">Income This Month</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(monthly.income)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Expense This Month</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(monthly.expense)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Net Cash Flow</div>
          <div className={'big ' + (netFlow >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{(netFlow >= 0 ? '' : '−') + window.fmtBig(Math.abs(netFlow))}
          </div>
          <div className={'delta ' + (netFlow >= 0 ? 'up' : 'down')}>{netFlow >= 0 ? 'Surplus' : 'Deficit'}</div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 32, textAlign: 'center' }}>
            <div className="empty">No accounts yet. Add your first account to get started →</div>
          </div>
        </div>
      ) : (
        <React.Fragment>
          {regularAccounts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="grp-h" style={{ marginBottom: 10 }}>Bank, Cash &amp; E-Wallet</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
                {regularAccounts.map(a => (
                  <AccountCard key={a.id} account={a} balance={a.balance} onEdit={() => setEditAcc(a)} />
                ))}
              </div>
            </div>
          )}
          {creditCards.length > 0 && (
            <div>
              <div className="grp-h" style={{ marginBottom: 10 }}>Credit Cards</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
                {creditCards.map(a => (
                  <AccountCard key={a.id} account={a} balance={a.balance} onEdit={() => setEditAcc(a)} />
                ))}
              </div>
            </div>
          )}
        </React.Fragment>
      )}

      <AccountModal open={addOpen || !!editAcc} account={editAcc}
                    onClose={() => { setAddOpen(false); setEditAcc(null); }} />
    </div>
  );
}
