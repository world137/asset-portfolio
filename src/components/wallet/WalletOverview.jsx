/* eslint-disable */
/* WalletOverview.jsx — Accounts page: account cards, balances, monthly summary */

/* ── Drag-to-transfer modal ──────────────────────────────────────────────── */
function DragTransferModal({ open, fromAccount, toAccount, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = React.useState('');
  const [date,   setDate]   = React.useState(today);
  const [fxRate, setFxRate] = React.useState('');
  const [note,   setNote]   = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setAmount(''); setDate(today); setFxRate(''); setNote('');
  }, [open]);

  if (!fromAccount || !toAccount) return null;

  const isCross   = fromAccount.currency !== toAccount.currency;
  const fromBal   = Store.accountBalance(fromAccount.id);
  const toBal     = Store.accountBalance(toAccount.id);
  const maxSend   = fromAccount.type !== 'credit_card' ? fromBal : null;
  const valid     = +amount > 0 && date && (!isCross || +fxRate > 0);

  const save = () => {
    if (!valid) return;
    Store.addTransaction({
      accountId:   fromAccount.id,
      toAccountId: toAccount.id,
      amount:      +amount,
      flow:        'transfer',
      date,
      categoryId:  null,
      note:        note.trim(),
      fxRate:      isCross ? +fxRate : null,
    });
    onClose();
  };

  const arrowStyle = { fontSize: 18, color: 'var(--accent)', fontWeight: 700, lineHeight: 1 };

  return (
    <Modal open={open} onClose={onClose}
           title="Transfer Between Accounts"
           subtitle="Move money from one account to another"
           footer={
             <React.Fragment>
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
               <Button variant="accent" icon="arrow-right" onClick={save} disabled={!valid}>
                 Transfer
               </Button>
             </React.Fragment>
           }
           width={460}>
      <div className="mgrid">
        {/* From → To header */}
        <div className="full" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>From</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{fromAccount.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
              Balance: {fromBal < 0 ? '−' + window.fmtCcy(-fromBal, fromAccount.currency) : window.fmtCcy(fromBal, fromAccount.currency)}
            </div>
          </div>
          <div style={arrowStyle}>→</div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>To</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{toAccount.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
              Balance: {toBal < 0 ? '−' + window.fmtCcy(-toBal, toAccount.currency) : window.fmtCcy(toBal, toAccount.currency)}
            </div>
          </div>
        </div>

        <div>
          <label className="flabel">Amount ({fromAccount.currency})</label>
          <input className="input" type="number" min="0" step="any" placeholder="0.00" autoFocus
                 value={amount} onChange={e => setAmount(e.target.value)} />
          {maxSend !== null && maxSend > 0 && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
              Available: {window.fmtCcy(maxSend, fromAccount.currency)}
              <button style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => setAmount(String(maxSend))}>
                Max
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="flabel">Date</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {isCross && (
          <div className="full">
            <label className="flabel">
              Exchange Rate (1 {fromAccount.currency} = ? {toAccount.currency})
            </label>
            <input className="input" type="number" min="0" step="any" placeholder="e.g. 33.5"
                   value={fxRate} onChange={e => setFxRate(e.target.value)} />
            {+fxRate > 0 && +amount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
                Recipient gets {window.fmtCcy(+amount * +fxRate, toAccount.currency)}
              </div>
            )}
          </div>
        )}

        <div className="full">
          <label className="flabel">Note (optional)</label>
          <input className="input" placeholder="e.g. Monthly savings transfer"
                 value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

/* ── Account card ────────────────────────────────────────────────────────── */
function AccountCard({ account, balance, onEdit, isDragging, isDropTarget, dragHandlers }) {
  const TYPE_LABELS = { bank: 'Bank', cash: 'Cash', credit_card: 'Credit Card', ewallet: 'E-Wallet' };
  const color   = account.color || '#5a6677';
  const isCC    = account.type === 'credit_card';
  const ccDebt  = isCC ? Math.max(0, -balance) : 0;
  const ccAvail = isCC && account.creditLimit ? Math.max(0, account.creditLimit - ccDebt) : 0;
  const utilPct = isCC && account.creditLimit ? Math.min((ccDebt / account.creditLimit) * 100, 100) : 0;
  const balColor = balance < 0 ? 'var(--red-600)' : (balance === 0 ? 'var(--fg-3)' : 'var(--fg-1)');

  const signedBalance = balance < 0
    ? '−' + window.fmtCcy(-balance, account.currency)
    : window.fmtCcy(balance, account.currency);

  const cardStyle = {
    borderTop: '3px solid ' + color,
    opacity:     isDragging   ? 0.45 : 1,
    outline:     isDropTarget ? '2px dashed var(--accent)' : 'none',
    outlineOffset: isDropTarget ? '2px' : '0',
    boxShadow:   isDropTarget ? '0 0 0 4px var(--accent)22' : undefined,
    cursor:      'grab',
    transition:  'opacity .15s, outline .1s, box-shadow .1s',
    userSelect:  'none',
  };

  return (
    <div className="card" style={cardStyle} {...dragHandlers}>
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
        {/* Stop drag propagation on the edit button so clicking edit still works */}
        <div onMouseDown={e => e.stopPropagation()} draggable={false}>
          <Button variant="ghost" size="sm" icon="edit" onClick={onEdit} />
        </div>
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
        {isDropTarget && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 500, textAlign: 'center' }}>
            Drop to transfer here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
function WalletOverview() {
  useStore();
  const settings  = Store.settings();
  const sym       = window.ccySymbol(settings.displayCcy);
  const wallet    = Store.getWallet();

  const [addOpen,  setAddOpen]  = React.useState(false);
  const [editAcc,  setEditAcc]  = React.useState(null);
  const [dragFrom, setDragFrom] = React.useState(null); // account id being dragged
  const [dragOver, setDragOver] = React.useState(null); // account id being hovered during drag
  const [transfer, setTransfer] = React.useState(null); // { fromId, toId }

  const accounts = wallet.accounts.filter(a => !a.archived);

  const accountsWithBal = accounts.map(a => ({
    ...a,
    balance:        Store.accountBalance(a.id),
    balanceDisplay: Store.walletToDisplay(Store.accountBalance(a.id), a.currency),
  }));

  const totalDisplay = accountsWithBal.reduce((s, a) => s + a.balanceDisplay, 0);

  const now     = new Date();
  const monthly = Store.monthlyFlow(now.getFullYear(), now.getMonth() + 1);
  const netFlow = monthly.income - monthly.expense;

  const regularAccounts = accountsWithBal.filter(a => a.type !== 'credit_card');
  const creditCards     = accountsWithBal.filter(a => a.type === 'credit_card');

  const dragHandlersFor = (accId) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragFrom(accId);
      e.dataTransfer.effectAllowed = 'move';
      // Tiny delay so the ghost image renders before opacity change
      setTimeout(() => setDragFrom(accId), 0);
    },
    onDragEnd: () => {
      setDragFrom(null);
      setDragOver(null);
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragFrom && dragFrom !== accId) setDragOver(accId);
    },
    onDragEnter: (e) => {
      e.preventDefault();
      if (dragFrom && dragFrom !== accId) setDragOver(accId);
    },
    onDragLeave: (e) => {
      // Only clear if leaving the card entirely (not entering a child)
      if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      if (dragFrom && dragFrom !== accId) {
        setTransfer({ fromId: dragFrom, toId: accId });
      }
      setDragFrom(null);
      setDragOver(null);
    },
  });

  const fromAcc = transfer ? accountsWithBal.find(a => a.id === transfer.fromId) : null;
  const toAcc   = transfer ? accountsWithBal.find(a => a.id === transfer.toId)   : null;

  const renderCard = (a) => (
    <AccountCard
      key={a.id}
      account={a}
      balance={a.balance}
      onEdit={() => setEditAcc(a)}
      isDragging={dragFrom === a.id}
      isDropTarget={dragOver === a.id && dragFrom !== a.id}
      dragHandlers={dragHandlersFor(a.id)}
    />
  );

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
          {dragFrom && (
            <div style={{ fontSize: 12, color: 'var(--accent)', textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>
              Drop onto another account to transfer
            </div>
          )}

          {regularAccounts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="grp-h" style={{ marginBottom: 10 }}>Bank, Cash &amp; E-Wallet</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
                {regularAccounts.map(renderCard)}
              </div>
            </div>
          )}
          {creditCards.length > 0 && (
            <div>
              <div className="grp-h" style={{ marginBottom: 10 }}>Credit Cards</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
                {creditCards.map(renderCard)}
              </div>
            </div>
          )}

          {accounts.length > 1 && !dragFrom && (
            <div style={{ fontSize: 11, color: 'var(--fg-4)', textAlign: 'center', marginTop: 14 }}>
              Drag any card onto another to transfer
            </div>
          )}
        </React.Fragment>
      )}

      <AccountModal open={addOpen || !!editAcc} account={editAcc}
                    onClose={() => { setAddOpen(false); setEditAcc(null); }} />

      <DragTransferModal
        open={!!transfer}
        fromAccount={fromAcc}
        toAccount={toAcc}
        onClose={() => setTransfer(null)}
      />
    </div>
  );
}
