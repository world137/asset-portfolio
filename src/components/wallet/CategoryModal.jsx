/* eslint-disable */
/* CategoryModal.jsx — Manage wallet income/expense categories */

const CAT_COLORS = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#ef4444','#0891b2','#84cc16','#f97316','#6b7280'];

function CategoryModal({ open, onClose }) {
  useStore();
  const wallet = Store.getWallet();

  const [newIncome,  setNewIncome]  = React.useState({ name: '', color: '#10b981' });
  const [newExpense, setNewExpense] = React.useState({ name: '', color: '#ef4444' });
  const [editCat,    setEditCat]    = React.useState(null); // { id, name, color, budget }
  const [editForm,   setEditForm]   = React.useState({ name: '', color: '', budget: '' });

  const income  = wallet.categories.filter(c => c.flow === 'income');
  const expense = wallet.categories.filter(c => c.flow === 'expense');

  const addCat = (flow, state, reset) => {
    if (!state.name.trim()) return;
    Store.addCategory({ name: state.name.trim(), flow, color: state.color || null });
    reset({ name: '', color: flow === 'income' ? '#10b981' : '#ef4444' });
  };

  const openEdit = (c) => {
    setEditCat(c);
    setEditForm({ name: c.name, color: c.color || '', budget: c.budget != null ? String(c.budget) : '' });
  };
  const saveEdit = () => {
    if (!editForm.name.trim()) return;
    Store.updateCategory(editCat.id, {
      name: editForm.name.trim(),
      color: editForm.color || null,
      budget: editForm.budget !== '' ? +editForm.budget : null,
    });
    setEditCat(null);
  };

  const ColorRow = ({ value, onChange }) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
      {CAT_COLORS.map(c => (
        <span key={c} onClick={() => onChange(c)}
              style={{ width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer', flexShrink: 0,
                       border: value === c ? '2.5px solid var(--fg-1)' : '2px solid transparent', boxSizing: 'border-box' }} />
      ))}
    </div>
  );

  const CatList = ({ items, flow, newState, setNew }) => (
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: flow === 'income' ? 'var(--green-600)' : 'var(--red-600)', marginBottom: 10 }}>
        {flow === 'income' ? '▲ Income' : '▼ Expense'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, minHeight: 32 }}>
        {items.length === 0 && (
          <div style={{ color: 'var(--fg-4)', fontSize: 12, padding: '4px 0' }}>No categories yet.</div>
        )}
        {items.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6,
                                   background: 'var(--bg-inset, var(--bg-app))', minHeight: 34 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color || '#6b7280', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
            {c.budget != null && (
              <span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>฿{window.fmtBig(c.budget)}/mo</span>
            )}
            <button onClick={() => openEdit(c)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)',
                             padding: '2px 5px', borderRadius: 4, lineHeight: 1, fontSize: 12 }}
                    title="Edit">✎</button>
            <button onClick={() => { if (window.confirm(`Delete category "${c.name}"?`)) Store.deleteCategory(c.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)',
                             padding: '2px 4px', borderRadius: 4, lineHeight: 1, fontSize: 13 }}
                    title="Delete">✕</button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 10 }}>
        <label className="flabel">Add New {flow === 'income' ? 'Income' : 'Expense'} Type</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <input className="input" style={{ flex: 1, height: 32, fontSize: 13 }}
                 placeholder="Category name"
                 value={newState.name}
                 onChange={e => setNew(s => ({ ...s, name: e.target.value }))}
                 onKeyDown={e => e.key === 'Enter' && addCat(flow, newState, setNew)} />
          <Button variant="accent" size="sm" icon="plus"
                  disabled={!newState.name.trim()}
                  onClick={() => addCat(flow, newState, setNew)}>
            Add
          </Button>
        </div>
        <ColorRow value={newState.color} onChange={c => setNew(s => ({ ...s, color: c }))} />
      </div>
    </div>
  );

  return (
    <React.Fragment>
      <Modal open={open} onClose={onClose} title="Manage Categories"
             subtitle="Add or remove income & expense types. Click ✎ to set a monthly budget on expense categories."
             footer={<Button variant="ghost" onClick={onClose}>Done</Button>} width={560}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <CatList items={income}  flow="income"  newState={newIncome}  setNew={setNewIncome} />
          <CatList items={expense} flow="expense" newState={newExpense} setNew={setNewExpense} />
        </div>
      </Modal>

      {/* Edit category modal */}
      {editCat && (
        <Modal open={!!editCat} onClose={() => setEditCat(null)} title={`Edit: ${editCat.name}`}
               footer={
                 <React.Fragment>
                   <Button variant="ghost" onClick={() => setEditCat(null)}>Cancel</Button>
                   <Button variant="accent" onClick={saveEdit} disabled={!editForm.name.trim()}>Save</Button>
                 </React.Fragment>
               } width={380}>
          <div className="mgrid">
            <div className="full">
              <label className="flabel">Name</label>
              <input className="input" value={editForm.name} onChange={e => setEditForm(s => ({ ...s, name: e.target.value }))} autoFocus />
            </div>
            {editCat.flow === 'expense' && (
              <div className="full">
                <label className="flabel">Monthly Budget (optional)</label>
                <input className="input" type="number" min="0" step="any" placeholder="e.g. 8000"
                       value={editForm.budget} onChange={e => setEditForm(s => ({ ...s, budget: e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                  A progress bar will appear in Wallet Summary when spending approaches this limit.
                </div>
              </div>
            )}
            <div className="full">
              <label className="flabel">Color</label>
              <ColorRow value={editForm.color} onChange={c => setEditForm(s => ({ ...s, color: c }))} />
            </div>
          </div>
        </Modal>
      )}
    </React.Fragment>
  );
}
