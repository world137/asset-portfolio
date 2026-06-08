/* eslint-disable */
/* BillsView.jsx — Monthly bill reminders: manage recurring payment due dates */

function BillModal({ open, bill, onClose }) {
  const today  = new Date();
  const blank  = { name: '', amount: '', currency: 'THB', dueDay: String(today.getDate()), categoryId: '', note: '', active: true };
  const [f, setF] = React.useState(blank);
  const wallet = Store.getWallet();

  React.useEffect(() => {
    if (!open) return;
    if (bill) {
      setF({
        name:       bill.name,
        amount:     bill.amount != null ? String(bill.amount) : '',
        currency:   bill.currency || 'THB',
        dueDay:     String(bill.dueDay || 1),
        categoryId: bill.categoryId || '',
        note:       bill.note || '',
        active:     bill.active !== false,
      });
    } else {
      setF(blank);
    }
  }, [open, bill]);

  const set     = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const editing = !!bill;
  const valid   = f.name.trim() && +f.dueDay >= 1 && +f.dueDay <= 31;

  const save = () => {
    if (!valid) return;
    const data = { name: f.name.trim(), amount: f.amount !== '' ? +f.amount : 0, currency: f.currency,
                   dueDay: +f.dueDay, categoryId: f.categoryId || null, note: f.note.trim(), active: f.active };
    if (editing) Store.updateBill(bill.id, data);
    else         Store.addBill(data);
    onClose();
  };

  const expenseCategories = (wallet.categories || []).filter(c => c.flow === 'expense');

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Bill' : 'Add Bill Reminder'}
           footer={
             <React.Fragment>
               {editing && (
                 <Button variant="ghost" style={{ marginRight: 'auto', color: 'var(--red-600)' }}
                         onClick={() => { Store.deleteBill(bill.id); onClose(); }}>Delete</Button>
               )}
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
               <Button variant="accent" onClick={save} disabled={!valid}>{editing ? 'Save' : 'Add'}</Button>
             </React.Fragment>
           } width={420}>
      <div className="mgrid">
        <div className="full">
          <label className="flabel">Bill Name</label>
          <input className="input" placeholder="e.g. Rent, Phone, Internet" value={f.name} onChange={set('name')} autoFocus />
        </div>
        <div>
          <label className="flabel">Amount (optional)</label>
          <input className="input" type="number" min="0" step="any" placeholder="0" value={f.amount} onChange={set('amount')} />
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
          <label className="flabel">Due Day of Month</label>
          <input className="input" type="number" min="1" max="31" step="1" value={f.dueDay} onChange={set('dueDay')} />
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>Day 1–31 each month</div>
        </div>
        <div>
          <label className="flabel">Category (optional)</label>
          <select className="input" value={f.categoryId} onChange={set('categoryId')}>
            <option value="">— None —</option>
            {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="full">
          <label className="flabel">Note (optional)</label>
          <input className="input" placeholder="e.g. Kasikorn Bank auto-debit" value={f.note} onChange={set('note')} />
        </div>
        <div className="full">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={f.active} onChange={e => setF(s => ({ ...s, active: e.target.checked }))} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active reminder</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

function BillsView() {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();
  const bills    = wallet.bills || [];

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editBill,  setEditBill]  = React.useState(null);

  const today   = new Date();
  const todayDay = today.getDate();

  const active   = bills.filter(b => b.active).sort((a, b) => a.dueDay - b.dueDay);
  const inactive = bills.filter(b => !b.active);

  const daysUntilDue = (dueDay) => {
    const d = dueDay - todayDay;
    return d < 0 ? d + new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() : d;
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Bills & Reminders</h1>
          <div className="t-small">Monthly recurring payment reminders — shown on calendar</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => { setEditBill(null); setModalOpen(true); }}>Add Bill</Button>
      </div>

      {bills.length === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">No bills yet. Add your recurring monthly payments to track them on the calendar.</div>
          </div>
        </div>
      ) : (
        <React.Fragment>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <div className="t">Active Bills ({active.length})</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th className="num" style={{ width: 80 }}>Due Day</th>
                    <th className="num">Amount</th>
                    <th style={{ width: 120 }}>Due In</th>
                    <th>Note</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {active.length === 0 && (
                    <tr><td colSpan={6}><div className="empty">No active bills.</div></td></tr>
                  )}
                  {active.map(b => {
                    const daysLeft = daysUntilDue(b.dueDay);
                    const isUrgent = daysLeft <= 3;
                    return (
                      <tr key={b.id} onClick={() => { setEditBill(b); setModalOpen(true); }} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{b.name}</td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{b.dueDay}</td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {b.amount > 0 ? window.fmtCcy(b.amount, b.currency) : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                        </td>
                        <td>
                          {daysLeft === 0 ? (
                            <span style={{ color: 'var(--red-600)', fontWeight: 600, fontSize: 12 }}>Due today</span>
                          ) : (
                            <span style={{ color: isUrgent ? '#f59e0b' : 'var(--fg-3)', fontSize: 12, fontWeight: isUrgent ? 600 : 400 }}>
                              {isUrgent && '⚠ '}{daysLeft} day{daysLeft !== 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>{b.note || ''}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" icon="edit"
                                  onClick={() => { setEditBill(b); setModalOpen(true); }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {inactive.length > 0 && (
            <div className="card">
              <div className="card-h"><div className="t">Inactive ({inactive.length})</div></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ptable">
                  <thead><tr>
                    <th>Bill</th><th className="num">Due Day</th><th className="num">Amount</th>
                    <th style={{ width: 40 }} />
                  </tr></thead>
                  <tbody>
                    {inactive.map(b => (
                      <tr key={b.id} onClick={() => { setEditBill(b); setModalOpen(true); }} style={{ cursor: 'pointer', opacity: 0.55 }}>
                        <td>{b.name}</td>
                        <td className="num">{b.dueDay}</td>
                        <td className="num">{b.amount > 0 ? window.fmtCcy(b.amount, b.currency) : '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" icon="edit"
                                  onClick={() => { setEditBill(b); setModalOpen(true); }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </React.Fragment>
      )}

      <BillModal open={modalOpen} bill={editBill} onClose={() => { setModalOpen(false); setEditBill(null); }} />
    </div>
  );
}
