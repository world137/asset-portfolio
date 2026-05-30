/* eslint-disable */
/* DebtModal.jsx — Add / edit a lend or borrow record */

function DebtModal({ open, debt, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { direction: 'lent', counterparty: '', amount: '', currency: 'THB', dateStart: today, dateDue: '', note: '' };
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
      });
    } else {
      setF(blank);
    }
  }, [open, debt]);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const editing = !!debt;
  const valid   = f.counterparty.trim() && +f.amount > 0 && f.dateStart;

  const save = () => {
    if (!valid) return;
    const data = {
      direction:    f.direction,
      counterparty: f.counterparty.trim(),
      amount:       +f.amount,
      currency:     f.currency,
      dateStart:    f.dateStart,
      dateDue:      f.dateDue || null,
      note:         f.note.trim(),
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
        </div>
      )}
    </Modal>
  );
}
