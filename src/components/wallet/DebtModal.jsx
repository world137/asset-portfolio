/* eslint-disable */
/* DebtModal.jsx — Add / edit a lend or borrow record */

function calcInstallment(amount, months, annualRate) {
  const a = +amount, m = +months, r = +annualRate;
  if (!a || a <= 0 || !m || m <= 0) return null;
  const totalInterest = a * (r / 100) * (m / 12);
  const monthlyPayment = (a + totalInterest) / m;
  return { monthlyPayment, totalInterest, totalPayable: a + totalInterest };
}

function DebtModal({ open, debt, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = {
    direction: 'lent', counterparty: '', amount: '', currency: 'THB',
    dateStart: today, dateDue: '', note: '',
    instEnabled: false, instMonths: '12', instRate: '0',
  };
  const [f, setF] = React.useState(blank);
  const [settling, setSettling]     = React.useState(false);
  const [settleDate, setSettleDate] = React.useState(today);

  React.useEffect(() => {
    if (!open) return;
    setSettling(false);
    if (debt) {
      setF({
        direction:    debt.direction,
        counterparty: debt.counterparty,
        amount:       String(debt.amount),
        currency:     debt.currency,
        dateStart:    debt.dateStart,
        dateDue:      debt.dateDue || '',
        note:         debt.note || '',
        instEnabled:  !!debt.installment,
        instMonths:   debt.installment ? String(debt.installment.months) : '12',
        instRate:     debt.installment ? String(debt.installment.interestRate) : '0',
      });
    } else {
      setF(blank);
    }
  }, [open, debt]);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const editing = !!debt;
  const valid   = f.counterparty.trim() && +f.amount > 0 && f.dateStart;
  const preview = f.instEnabled ? calcInstallment(f.amount, f.instMonths, f.instRate) : null;

  const save = () => {
    if (!valid) return;
    let installment = null;
    if (f.instEnabled && +f.instMonths > 0) {
      installment = {
        months:       +f.instMonths,
        interestRate: +f.instRate,
        paidMonths:   (editing && debt.installment) ? debt.installment.paidMonths : 0,
      };
    }
    const data = {
      direction:    f.direction,
      counterparty: f.counterparty.trim(),
      amount:       +f.amount,
      currency:     f.currency,
      dateStart:    f.dateStart,
      dateDue:      f.dateDue || null,
      note:         f.note.trim(),
      installment,
    };
    if (editing) Store.updateDebt(debt.id, data);
    else         Store.addDebt(data);
    onClose();
  };

  const confirmSettle = () => {
    Store.settleDebt(debt.id, settleDate);
    onClose();
  };

  const footer = settling ? (
    <React.Fragment>
      <Button variant="ghost" onClick={() => setSettling(false)}>Back</Button>
      <Button variant="accent" icon="check" onClick={confirmSettle}>Confirm Settled</Button>
    </React.Fragment>
  ) : (
    <React.Fragment>
      {editing && !debt.settled && (
        <Button variant="secondary" icon="check" style={{ marginRight: 'auto' }}
                onClick={() => setSettling(true)}>
          Mark Settled
        </Button>
      )}
      {editing && (
        <Button variant="ghost" style={{ color: 'var(--red-600)' }}
                onClick={() => { if (confirm('Delete this debt record?')) { Store.deleteDebt(debt.id); onClose(); } }}>
          Delete
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="accent" onClick={save} disabled={!valid}>
        {editing ? 'Save' : 'Add'}
      </Button>
    </React.Fragment>
  );

  const directionLabel = f.direction === 'lent' ? 'I lent to' : 'I borrowed from';

  return (
    <Modal open={open} onClose={onClose}
           title={settling ? 'Mark as Settled' : (editing ? 'Edit Debt' : 'Add Debt')}
           subtitle={!settling && !editing ? 'Track money you lent or borrowed' : null}
           footer={footer} width={480}>
      {settling ? (
        <div className="mgrid">
          <div className="full" style={{ color: 'var(--fg-2)', marginBottom: 4 }}>
            Settling <strong>{debt.counterparty}</strong> · {window.fmtCcy(debt.amount, debt.currency)}
          </div>
          <div className="full">
            <label className="flabel">Settlement Date</label>
            <input className="input" type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="mgrid">
          <div className="full">
            <label className="flabel">Direction</label>
            <div className="layoutseg" style={{ marginTop: 2 }}>
              <button className={f.direction === 'lent' ? 'on' : ''} onClick={() => setF(s => ({ ...s, direction: 'lent' }))}>
                I Lent
              </button>
              <button className={f.direction === 'borrowed' ? 'on' : ''} onClick={() => setF(s => ({ ...s, direction: 'borrowed' }))}>
                I Borrowed
              </button>
            </div>
          </div>

          <div className="full">
            <label className="flabel">{directionLabel}</label>
            <input className="input" placeholder="Name of person" value={f.counterparty} onChange={set('counterparty')} autoFocus={!editing} />
          </div>

          <div>
            <label className="flabel">Amount</label>
            <input className="input" type="number" min="0" step="any" placeholder="0.00"
                   value={f.amount} onChange={set('amount')} />
          </div>

          <div>
            <label className="flabel">Currency</label>
            <select className="input" value={f.currency} onChange={set('currency')}>
              {(window.WALLET_CURRENCIES || ['THB', 'USD', 'JPY', 'KRW']).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flabel">Start Date</label>
            <input className="input" type="date" value={f.dateStart} onChange={set('dateStart')} />
          </div>

          <div>
            <label className="flabel">Due Date (optional)</label>
            <input className="input" type="date" value={f.dateDue} onChange={set('dateDue')} />
          </div>

          <div className="full">
            <label className="flabel">Note (optional)</label>
            <input className="input" placeholder="Reason, details…" value={f.note} onChange={set('note')} />
          </div>

          {/* ── Installment Plan ─────────────────────────────────────────────── */}
          <div className="full" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={f.instEnabled}
                     onChange={e => setF(s => ({ ...s, instEnabled: e.target.checked }))} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>Installment Plan</span>
            </label>
          </div>

          {f.instEnabled && (
            <React.Fragment>
              <div>
                <label className="flabel">Number of Months</label>
                <input className="input" type="number" min="1" max="120" step="1"
                       placeholder="12" value={f.instMonths} onChange={set('instMonths')} />
              </div>

              <div>
                <label className="flabel">Annual Interest Rate (%)</label>
                <input className="input" type="number" min="0" step="0.01"
                       placeholder="0.00" value={f.instRate} onChange={set('instRate')} />
              </div>

              {preview && (
                <div className="full" style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'var(--fg-2)' }}>Monthly Payment</span>
                    <strong>{window.fmtCcy(preview.monthlyPayment, f.currency)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-3)', fontSize: 12 }}>
                    <span>Total Interest</span>
                    <span>{window.fmtCcy(preview.totalInterest, f.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>
                    <span>Total Payable</span>
                    <span>{window.fmtCcy(preview.totalPayable, f.currency)}</span>
                  </div>
                </div>
              )}

              {editing && debt.installment && (
                <div className="full" style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                  {debt.installment.paidMonths || 0} of {debt.installment.months} months paid
                </div>
              )}
            </React.Fragment>
          )}
        </div>
      )}
    </Modal>
  );
}
