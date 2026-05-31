/* eslint-disable */
/* DebtTracker.jsx — Debt & Outstanding tracker */

function calcInstallment(amount, months, annualRate) {
  const a = +amount, m = +months, r = +annualRate;
  if (!a || a <= 0 || !m || m <= 0) return null;
  const totalInterest = a * (r / 100) * (m / 12);
  const monthlyPayment = (a + totalInterest) / m;
  return { monthlyPayment, totalInterest, totalPayable: a + totalInterest };
}

/* ── Pay-installment account picker ─────────────────────────────────────── */
function PayInstallmentModal({ open, debt, onClose }) {
  const today    = new Date().toISOString().slice(0, 10);
  const wallet   = Store.getWallet();
  const accounts = wallet.accounts.filter(a => !a.archived);

  const [accountId, setAccountId] = React.useState('');
  const [date, setDate]           = React.useState(today);

  const linkedAcc  = debt ? (debt.linkedAccountId ? accounts.find(a => a.id === debt.linkedAccountId) : null) : null;
  const isLinkedCC = !!(linkedAcc && linkedAcc.type === 'credit_card');

  // For CC-linked debts, only non-CC accounts are valid payers
  const payableAccounts = (debt && debt.direction === 'borrowed' && isLinkedCC)
    ? accounts.filter(a => a.type !== 'credit_card')
    : accounts;

  React.useEffect(() => {
    if (!open || !debt) return;
    setDate(today);
    // Default: first valid non-CC account (never default to the linked CC)
    const firstValid = payableAccounts[0];
    setAccountId(firstValid ? firstValid.id : '');
  }, [open, debt]);

  if (!debt) return null;

  const instCalc = debt.installment
    ? calcInstallment(debt.amount, debt.installment.months, debt.installment.interestRate)
    : null;
  const paidMo  = debt.installment ? (debt.installment.paidMonths || 0) : 0;
  const totalMo = debt.installment ? debt.installment.months : 0;
  const isDebt  = debt.direction === 'borrowed';
  const payingAcc = accounts.find(a => a.id === accountId);

  let accLabel = isDebt ? 'Pay from account' : 'Receive repayment into account';
  let accHint  = '';
  if (isDebt && accountId && payingAcc) {
    if (isLinkedCC) {
      accHint = `Transfer from ${payingAcc.name} → ${linkedAcc.name}. Both balances will update.`;
    } else {
      accHint = 'Expense recorded on this account.';
    }
  } else if (!isDebt && accountId) {
    accHint = 'Income recorded on this account.';
  }

  const confirm_ = () => {
    Store.payInstallmentMonth(debt.id, accountId || null, date);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}
           title={isDebt ? 'Record Debt Payment' : 'Record Repayment Received'}
           footer={
             <React.Fragment>
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
               <Button variant="accent" icon="check" onClick={confirm_}>Confirm</Button>
             </React.Fragment>
           }
           width={400}>
      <div className="mgrid">
        <div className="full" style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--fg-2)' }}>{debt.counterparty}</span>
            <span>Month {paidMo + 1} / {totalMo}</span>
          </div>
          {instCalc && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 600 }}>
              <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>Payment</span>
              <span style={{ color: isDebt ? 'var(--red-600)' : 'var(--green-600)' }}>
                {window.fmtCcy(instCalc.monthlyPayment, debt.currency)}
              </span>
            </div>
          )}
          {isDebt && isLinkedCC && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-3)' }}>
              Linked to: <strong>{linkedAcc.name}</strong> — payment will transfer from your bank/cash account to the card.
            </div>
          )}
        </div>
        <div className="full">
          <label className="flabel">Date</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="full">
          <label className="flabel">{accLabel} (optional)</label>
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">— Skip transaction —</option>
            {payableAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
          {isDebt && isLinkedCC && payableAccounts.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 3 }}>
              No bank/cash accounts found. Add one to record this payment.
            </div>
          )}
          {accHint && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>{accHint}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DebtTracker() {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();

  const [modalOpen, setModalOpen]   = React.useState(false);
  const [editDebt,  setEditDebt]    = React.useState(null);
  const [tab, setTab]               = React.useState('outstanding'); // 'outstanding' | 'settled'
  const [payingDebt, setPayingDebt] = React.useState(null);

  const debts    = wallet.debts;
  const summary  = Store.debtSummary();

  const outstanding = debts.filter(d => !d.settled).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
  const settled     = debts.filter(d =>  d.settled).sort((a, b) => b.settledDate?.localeCompare(a.settledDate || '') || 0);
  const displayed   = tab === 'outstanding' ? outstanding : settled;

  const net = summary.totalLent - summary.totalBorrowed;

  const today = new Date().toISOString().slice(0, 10);

  const hasInstallments = outstanding.some(d => d.installment);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Debts & Outstanding</h1>
          <div className="t-small">Track money you owe or are owed</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => { setEditDebt(null); setModalOpen(true); }}>
          Add Record
        </Button>
      </div>

      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi">
          <div className="lab">Total Debt</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(summary.totalBorrowed)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>you owe</div>
        </div>
        <div className="kpi accent">
          <div className="lab">Total Outstanding</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(summary.totalLent)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>owed to you</div>
        </div>
        <div className="kpi">
          <div className="lab">Net Position</div>
          <div className={'big ' + (net >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{window.fmtBig(Math.abs(net))}
          </div>
          <div className={'delta ' + (net >= 0 ? 'up' : 'down')}>
            {net >= 0 ? 'Others owe you more' : 'You owe others more'}
          </div>
        </div>
        <div className="kpi">
          <div className="lab">Monthly Installment</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(summary.monthlyInstallment)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{outstanding.length} active · {settled.length} settled</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 0 }}>
          <div className="layoutseg" style={{ marginBottom: 0 }}>
            <button className={tab === 'outstanding' ? 'on' : ''} onClick={() => setTab('outstanding')}>
              Active ({outstanding.length})
            </button>
            <button className={tab === 'settled' ? 'on' : ''} onClick={() => setTab('settled')}>
              Settled ({settled.length})
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ptable">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Type</th>
                <th>Person</th>
                <th className="num">Amount</th>
                <th style={{ width: 90 }}>Start</th>
                <th style={{ width: 100 }}>Due / Settled</th>
                <th>Note {hasInstallments && tab === 'outstanding' ? '/ Progress' : ''}</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      {tab === 'outstanding' ? 'No active debts or outstanding.' : 'No settled records yet.'}
                    </div>
                  </td>
                </tr>
              )}
              {displayed.map(d => {
                const isOutstanding = d.direction === 'lent';
                const isOverdue     = !d.settled && d.dateDue && d.dateDue < today;
                const instCalc      = d.installment ? calcInstallment(d.amount, d.installment.months, d.installment.interestRate) : null;
                const paidMo        = d.installment ? (d.installment.paidMonths || 0) : 0;
                const totalMo       = d.installment ? d.installment.months : 0;
                const canPay        = d.installment && !d.settled && paidMo < totalMo;

                // For CC-linked non-installment debts: show actual remaining CC balance, not original amount
                const linkedAcct = d.linkedAccountId ? wallet.accounts.find(a => a.id === d.linkedAccountId) : null;
                const isCCLinked = !d.installment && linkedAcct && linkedAcct.type === 'credit_card';
                const displayAmt = isCCLinked
                  ? Math.max(0, -Store.accountBalance(d.linkedAccountId))
                  : d.amount;

                return (
                  <tr key={d.id} onClick={() => { setEditDebt(d); setModalOpen(true); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="sectorchip"
                            style={{
                              background: isOutstanding ? 'var(--green-600)22' : 'var(--red-600)22',
                              color: isOutstanding ? 'var(--green-600)' : 'var(--red-600)',
                            }}>
                        {isOutstanding ? 'Outstanding' : 'Debt'}
                      </span>
                      {d.installment && (
                        <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 3 }}>Installment</div>
                      )}
                      {isCCLinked && (
                        <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 3 }}>CC Balance</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{d.counterparty}</td>
                    <td className="num" style={{ fontWeight: 600, color: isOutstanding ? 'var(--green-600)' : 'var(--red-600)' }}>
                      {window.fmtCcy(displayAmt, d.currency)}
                      {isCCLinked && displayAmt !== d.amount && (
                        <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--fg-4)', marginTop: 2, textDecoration: 'line-through' }}>
                          {window.fmtCcy(d.amount, d.currency)}
                        </div>
                      )}
                      {instCalc && (
                        <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                          {window.fmtCcy(instCalc.monthlyPayment, d.currency)}/mo
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>{d.dateStart}</td>
                    <td style={{ fontSize: 12 }}>
                      {d.settled ? (
                        <span style={{ color: 'var(--green-600)' }}>✓ {d.settledDate}</span>
                      ) : d.dateDue ? (
                        <span style={{ color: isOverdue ? 'var(--red-600)' : 'var(--fg-3)' }}>
                          {isOverdue ? '⚠ ' : ''}{d.dateDue}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-4)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                      {d.note || ''}
                      {d.installment && (
                        <div style={{ marginTop: d.note ? 4 : 0 }}>
                          <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 3 }}>
                            {paidMo}/{totalMo} months paid
                          </div>
                          <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, width: 72, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: totalMo > 0 ? `${(paidMo / totalMo) * 100}%` : '0%',
                              background: isOutstanding ? 'var(--green-600)' : 'var(--red-600)',
                              borderRadius: 2,
                            }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        {canPay && (
                          <Button variant="ghost" size="sm"
                                  title={`Record payment ${paidMo + 1} of ${totalMo}`}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setPayingDebt(d);
                                  }}>
                            {isOutstanding ? 'Receive' : 'Pay'}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" icon="edit"
                                onClick={e => { e.stopPropagation(); setEditDebt(d); setModalOpen(true); }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DebtModal open={modalOpen} debt={editDebt}
                 onClose={() => { setModalOpen(false); setEditDebt(null); }} />

      <PayInstallmentModal open={!!payingDebt} debt={payingDebt}
                           onClose={() => setPayingDebt(null)} />
    </div>
  );
}
