/* eslint-disable */
/* RecurringView.jsx — Recurring transaction templates with manual generation */

function RecurringModal({ open, item, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { name: '', amount: '', flow: 'expense', accountId: '', categoryId: '', dayOfMonth: '1', note: '', active: true };
  const [f, setF] = React.useState(blank);
  const wallet = Store.getWallet();

  React.useEffect(() => {
    if (!open) return;
    const accounts = (wallet.accounts || []).filter(a => !a.archived);
    if (item) {
      setF({
        name:       item.name,
        amount:     item.amount != null ? String(item.amount) : '',
        flow:       item.flow || 'expense',
        accountId:  item.accountId || '',
        categoryId: item.categoryId || '',
        dayOfMonth: String(item.dayOfMonth || 1),
        note:       item.note || '',
        active:     item.active !== false,
      });
    } else {
      setF({ ...blank, accountId: accounts[0]?.id || '' });
    }
  }, [open, item]);

  const set     = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const editing = !!item;
  const valid   = f.name.trim() && +f.amount > 0 && f.accountId && +f.dayOfMonth >= 1 && +f.dayOfMonth <= 31;

  const accounts   = (wallet.accounts || []).filter(a => !a.archived);
  const categories = (wallet.categories || []).filter(c => c.flow === f.flow);

  const save = () => {
    if (!valid) return;
    const data = { name: f.name.trim(), amount: +f.amount, flow: f.flow, accountId: f.accountId,
                   categoryId: f.categoryId || null, dayOfMonth: +f.dayOfMonth, note: f.note.trim(), active: f.active };
    if (editing) Store.updateRecurring(item.id, data);
    else         Store.addRecurring(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Recurring' : 'Add Recurring Transaction'}
           footer={
             <React.Fragment>
               {editing && (
                 <Button variant="ghost" style={{ marginRight: 'auto', color: 'var(--red-600)' }}
                         onClick={() => { Store.deleteRecurring(item.id); onClose(); }}>Delete</Button>
               )}
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
               <Button variant="accent" onClick={save} disabled={!valid}>{editing ? 'Save' : 'Add'}</Button>
             </React.Fragment>
           } width={460}>
      <div className="mgrid">
        <div className="full">
          <label className="flabel">Template Name</label>
          <input className="input" placeholder="e.g. Monthly Rent, Netflix Subscription" value={f.name} onChange={set('name')} autoFocus />
        </div>
        <div>
          <label className="flabel">Type</label>
          <div className="layoutseg" style={{ marginTop: 2 }}>
            {['income', 'expense'].map(fl => (
              <button key={fl} className={f.flow === fl ? 'on' : ''}
                      onClick={() => setF(s => ({ ...s, flow: fl, categoryId: '' }))}>
                {fl.charAt(0).toUpperCase() + fl.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="flabel">Day of Month</label>
          <input className="input" type="number" min="1" max="31" step="1" value={f.dayOfMonth} onChange={set('dayOfMonth')} />
        </div>
        <div>
          <label className="flabel">Account</label>
          <select className="input" value={f.accountId} onChange={set('accountId')}>
            <option value="">Select…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </div>
        <div>
          <label className="flabel">Amount</label>
          <input className="input" type="number" min="0" step="any" placeholder="0.00" value={f.amount} onChange={set('amount')} />
        </div>
        <div>
          <label className="flabel">Category (optional)</label>
          <select className="input" value={f.categoryId} onChange={set('categoryId')}>
            <option value="">— None —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="full">
          <label className="flabel">Note (optional)</label>
          <input className="input" placeholder="e.g. Auto-debit from SCB" value={f.note} onChange={set('note')} />
        </div>
        <div className="full">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={f.active} onChange={e => setF(s => ({ ...s, active: e.target.checked }))} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

function RecurringView() {
  useStore();
  const settings  = Store.settings();
  const sym       = window.ccySymbol(settings.displayCcy);
  const wallet    = Store.getWallet();
  const recurring = wallet.recurring || [];

  const [modalOpen,  setModalOpen]  = React.useState(false);
  const [editItem,   setEditItem]   = React.useState(null);
  const [generating, setGenerating] = React.useState(null); // id being confirmed for generation

  const today = new Date().toISOString().slice(0, 10);
  const accounts  = wallet.accounts || [];
  const accMap    = {};
  for (const a of accounts) accMap[a.id] = a;
  const catMap    = {};
  for (const c of wallet.categories || []) catMap[c.id] = c;

  const active   = recurring.filter(r => r.active);
  const inactive = recurring.filter(r => !r.active);

  const isDueThisMonth = (r) => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return !r.lastGenerated || !r.lastGenerated.startsWith(monthPrefix);
  };

  const confirmGenerate = (r) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(r.dayOfMonth).padStart(2, '0')}`;
    Store.generateRecurring(r.id, dateStr);
    setGenerating(null);
  };

  const duePending = active.filter(isDueThisMonth);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Recurring Transactions</h1>
          <div className="t-small">Templates for regular income or expenses — generate manually each month</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => { setEditItem(null); setModalOpen(true); }}>Add Template</Button>
      </div>

      {duePending.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1.5px solid #f59e0b66', background: '#f59e0b08' }}>
          <div className="card-h">
            <div><div className="t" style={{ color: '#d97706' }}>⚠ Pending This Month</div>
              <div className="s">{duePending.length} recurring transaction{duePending.length > 1 ? 's' : ''} not yet generated for this month</div>
            </div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {duePending.map(r => {
              const acc = accMap[r.accountId];
              const cat = catMap[r.categoryId];
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                      Day {r.dayOfMonth} · {acc ? acc.name : '?'} {cat ? '· ' + cat.name : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: r.flow === 'income' ? 'var(--green-600)' : 'var(--red-600)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {r.flow === 'income' ? '+' : '−'}{window.fmtCcy(r.amount, acc ? acc.currency : 'THB')}
                  </div>
                  <Button variant="accent" size="sm" icon="check"
                          onClick={() => setGenerating(r.id)}>Generate</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recurring.length === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">No recurring templates yet. Add templates for rent, subscriptions, salary, etc.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-h"><div className="t">All Templates ({recurring.length})</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable">
              <thead><tr>
                <th>Name</th>
                <th>Account</th>
                <th className="num" style={{ width: 80 }}>Day</th>
                <th className="num">Amount</th>
                <th style={{ width: 100 }}>Last Run</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 32 }} />
              </tr></thead>
              <tbody>
                {[...active, ...inactive].map(r => {
                  const acc       = accMap[r.accountId];
                  const cat       = catMap[r.categoryId];
                  const due       = r.active && isDueThisMonth(r);
                  return (
                    <tr key={r.id} onClick={() => { setEditItem(r); setModalOpen(true); }} style={{ cursor: 'pointer', opacity: r.active ? 1 : 0.5 }}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.name}</div>
                        {cat && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{cat.name}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--fg-2)' }}>{acc ? acc.name : '—'}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{r.dayOfMonth}</td>
                      <td className="num" style={{ fontWeight: 600, color: r.flow === 'income' ? 'var(--green-600)' : 'var(--red-600)' }}>
                        {r.flow === 'income' ? '+' : '−'}{window.fmtCcy(r.amount, acc ? acc.currency : 'THB')}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                        {r.lastGenerated || <span style={{ color: 'var(--fg-4)' }}>Never</span>}
                      </td>
                      <td>
                        {!r.active ? (
                          <span className="sectorchip" style={{ fontSize: 10, color: 'var(--fg-3)' }}>Inactive</span>
                        ) : due ? (
                          <span className="sectorchip" style={{ background: '#f59e0b22', color: '#d97706', fontSize: 10, fontWeight: 700 }}>Due</span>
                        ) : (
                          <span className="sectorchip" style={{ background: 'var(--green-600)18', color: 'var(--green-600)', fontSize: 10 }}>Done</span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" icon="edit"
                                onClick={() => { setEditItem(r); setModalOpen(true); }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RecurringModal open={modalOpen} item={editItem} onClose={() => { setModalOpen(false); setEditItem(null); }} />

      {/* Generate confirm modal */}
      {generating && (() => {
        const r = recurring.find(x => x.id === generating);
        if (!r) return null;
        const acc = accMap[r.accountId];
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(r.dayOfMonth).padStart(2, '0')}`;
        return (
          <Modal open={true} onClose={() => setGenerating(null)} title="Generate Transaction"
                 footer={
                   <React.Fragment>
                     <Button variant="ghost" onClick={() => setGenerating(null)}>Cancel</Button>
                     <Button variant="accent" icon="check" onClick={() => confirmGenerate(r)}>Confirm</Button>
                   </React.Fragment>
                 } width={380}>
            <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2)' }}>
                <span>Date</span><span>{dateStr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 700 }}>
                <span style={{ color: 'var(--fg-2)', fontWeight: 400 }}>Amount</span>
                <span style={{ color: r.flow === 'income' ? 'var(--green-600)' : 'var(--red-600)' }}>
                  {r.flow === 'income' ? '+' : '−'}{window.fmtCcy(r.amount, acc ? acc.currency : 'THB')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: 'var(--fg-3)', fontSize: 12 }}>
                <span>Account</span><span>{acc ? acc.name : '—'}</span>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
