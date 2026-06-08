/* eslint-disable */
/* SavingsGoalsView.jsx — Cash savings goals with progress bars & projected completion */

const GOAL_EMOJIS = ['🎯','🏖','🏠','🚗','✈️','💍','🎓','🏋️','📱','💻','🐶','👶'];

function SavingsGoalModal({ open, goal, onClose }) {
  const blank = { name: '', targetAmount: '', currency: 'THB', targetDate: '', linkedAccountId: '', note: '', emoji: '🎯' };
  const [f, setF] = React.useState(blank);
  const wallet = Store.getWallet();

  React.useEffect(() => {
    if (!open) return;
    if (goal) {
      setF({
        name:            goal.name,
        targetAmount:    String(goal.targetAmount || ''),
        currency:        goal.currency || 'THB',
        targetDate:      goal.targetDate || '',
        linkedAccountId: goal.linkedAccountId || '',
        note:            goal.note || '',
        emoji:           goal.emoji || '🎯',
      });
    } else {
      setF(blank);
    }
  }, [open, goal]);

  const set     = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const editing = !!goal;
  const valid   = f.name.trim() && +f.targetAmount > 0;

  const accounts = (wallet.accounts || []).filter(a => !a.archived && a.type !== 'credit_card');

  const save = () => {
    if (!valid) return;
    const data = { name: f.name.trim(), targetAmount: +f.targetAmount, currency: f.currency,
                   targetDate: f.targetDate || null, linkedAccountId: f.linkedAccountId || null,
                   note: f.note.trim(), emoji: f.emoji || '🎯' };
    if (editing) Store.updateSavingsGoal(goal.id, data);
    else         Store.addSavingsGoal(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Savings Goal' : 'Add Savings Goal'}
           footer={
             <React.Fragment>
               {editing && (
                 <Button variant="ghost" style={{ marginRight: 'auto', color: 'var(--red-600)' }}
                         onClick={() => { Store.deleteSavingsGoal(goal.id); onClose(); }}>Delete</Button>
               )}
               <Button variant="ghost" onClick={onClose}>Cancel</Button>
               <Button variant="accent" onClick={save} disabled={!valid}>{editing ? 'Save' : 'Add'}</Button>
             </React.Fragment>
           } width={460}>
      <div className="mgrid">
        <div className="full">
          <label className="flabel">Goal Name</label>
          <input className="input" placeholder="e.g. Japan Trip, Emergency Fund, New Laptop" value={f.name} onChange={set('name')} autoFocus />
        </div>
        <div className="full">
          <label className="flabel">Emoji</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {GOAL_EMOJIS.map(e => (
              <span key={e} onClick={() => setF(s => ({ ...s, emoji: e }))}
                    style={{ fontSize: 20, cursor: 'pointer', padding: '2px 4px', borderRadius: 6,
                             background: f.emoji === e ? 'var(--accent)22' : 'transparent',
                             border: f.emoji === e ? '1.5px solid var(--accent)' : '1.5px solid transparent' }}>
                {e}
              </span>
            ))}
          </div>
        </div>
        <div>
          <label className="flabel">Target Amount</label>
          <input className="input" type="number" min="0" step="any" placeholder="e.g. 50000" value={f.targetAmount} onChange={set('targetAmount')} />
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
          <label className="flabel">Target Date (optional)</label>
          <input className="input" type="date" value={f.targetDate} onChange={set('targetDate')} />
        </div>
        <div>
          <label className="flabel">Linked Account (optional)</label>
          <select className="input" value={f.linkedAccountId} onChange={set('linkedAccountId')}>
            <option value="">— Not linked —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>Current balance of this account counts as progress.</div>
        </div>
        <div className="full">
          <label className="flabel">Note (optional)</label>
          <input className="input" placeholder="What's this for?" value={f.note} onChange={set('note')} />
        </div>
      </div>
    </Modal>
  );
}

function SavingsGoalsView() {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();
  const goals    = wallet.savingsGoals || [];

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editGoal,  setEditGoal]  = React.useState(null);

  const today = new Date().toISOString().slice(0, 10);

  const goalsWithProgress = goals.map(g => {
    const current = g.linkedAccountId
      ? Math.max(0, Store.accountBalance(g.linkedAccountId))
      : null;
    const pct     = current != null ? Math.min((current / g.targetAmount) * 100, 100) : null;
    const isDone  = current != null && current >= g.targetAmount;
    const remaining = current != null ? Math.max(0, g.targetAmount - current) : null;

    // Project completion based on last 3 months of net deposits into the linked account
    let projectedDate = null;
    if (current != null && remaining > 0 && g.linkedAccountId) {
      const now = new Date();
      let totalNet = 0, months = 0;
      for (let mo = 0; mo < 3; mo++) {
        const d = new Date(now.getFullYear(), now.getMonth() - mo, 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let net = 0;
        for (const t of wallet.transactions) {
          if (!t.date.startsWith(prefix) || t.accountId !== g.linkedAccountId) continue;
          if (t.flow === 'income') net += t.amount;
          if (t.flow === 'expense') net -= t.amount;
        }
        totalNet += net; months++;
      }
      const avgMonthly = months > 0 ? totalNet / months : 0;
      if (avgMonthly > 0) {
        const monthsNeeded = Math.ceil(remaining / avgMonthly);
        const projDate = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1);
        projectedDate = projDate.toISOString().slice(0, 7);
      }
    }

    return { ...g, current, pct, isDone, remaining, projectedDate };
  });

  const totalGoals   = goals.length;
  const doneGoals    = goalsWithProgress.filter(g => g.isDone).length;
  const totalTarget  = goalsWithProgress.reduce((s, g) => s + Store.walletToDisplay(g.targetAmount, g.currency), 0);
  const totalCurrent = goalsWithProgress.reduce((s, g) => s + (g.current != null ? Store.walletToDisplay(g.current, g.currency) : 0), 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Savings Goals</h1>
          <div className="t-small">Cash savings targets linked to wallet accounts</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => { setEditGoal(null); setModalOpen(true); }}>Add Goal</Button>
      </div>

      {goals.length > 0 && (
        <div className="kpis" style={{ marginBottom: 22 }}>
          <div className="kpi accent">
            <div className="lab">Total Goals</div>
            <div className="big">{totalGoals}</div>
            <div className="delta" style={{ color: 'var(--fg-3)' }}>{doneGoals} completed</div>
          </div>
          <div className="kpi">
            <div className="lab">Total Target</div>
            <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totalTarget)}</div>
          </div>
          <div className="kpi">
            <div className="lab">Saved So Far</div>
            <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(totalCurrent)}</div>
          </div>
          <div className="kpi">
            <div className="lab">Overall Progress</div>
            <div className="big">{totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) + '%' : '—'}</div>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">No savings goals yet. Set a target to track your progress toward any financial goal.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px,100%), 1fr))', gap: 14 }}>
          {goalsWithProgress.map(g => {
            const linkedAcc = g.linkedAccountId ? (wallet.accounts || []).find(a => a.id === g.linkedAccountId) : null;
            const overdue   = !g.isDone && g.targetDate && g.targetDate < today;
            return (
              <div key={g.id} className="card" style={{ cursor: 'pointer', borderTop: g.isDone ? '3px solid var(--green-600)' : '3px solid var(--accent)' }}
                   onClick={() => { setEditGoal(g); setModalOpen(true); }}>
                <div style={{ padding: '14px 16px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{g.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                      {g.note && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{g.note}</div>}
                      {linkedAcc && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Linked: {linkedAcc.name}</div>}
                    </div>
                    {g.isDone && (
                      <span className="sectorchip" style={{ background: 'var(--green-600)22', color: 'var(--green-600)', fontWeight: 700 }}>Done!</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {g.current != null ? (
                    <React.Fragment>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-2)', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: g.isDone ? 'var(--green-600)' : 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                          {window.fmtCcy(g.current, g.currency)}
                        </span>
                        <span style={{ color: 'var(--fg-3)' }}>of {window.fmtCcy(g.targetAmount, g.currency)}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ width: g.pct + '%', height: '100%', borderRadius: 4, transition: 'width .4s',
                                      background: g.isDone ? 'var(--green-600)' : g.pct >= 75 ? '#f59e0b' : 'var(--accent)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-3)' }}>
                        <span>{g.pct != null ? Math.round(g.pct) + '%' : ''}</span>
                        {g.remaining > 0 && <span>฿{window.fmtBig(g.remaining)} remaining</span>}
                      </div>
                    </React.Fragment>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--fg-2)', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>Target: {window.fmtCcy(g.targetAmount, g.currency)}</span>
                    </div>
                  )}

                  {/* Target date & projection */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6 }}>
                    {g.targetDate && (
                      <span style={{ color: overdue ? 'var(--red-600)' : 'var(--fg-3)' }}>
                        {overdue ? '⚠ Overdue: ' : 'Target: '}{g.targetDate}
                      </span>
                    )}
                    {g.projectedDate && !g.isDone && (
                      <span style={{ color: 'var(--fg-3)' }}>Projected: {g.projectedDate}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SavingsGoalModal open={modalOpen} goal={editGoal} onClose={() => { setModalOpen(false); setEditGoal(null); }} />
    </div>
  );
}
