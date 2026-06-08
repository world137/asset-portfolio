/* eslint-disable */
/* GoalsView.jsx — Feature #3: Financial Goals Tracker */

const GOAL_EMOJIS = ['🎯','🏠','🚗','✈️','🎓','💍','🏖️','💰','📈','🏋️','🌏','🎁'];

function GoalModal({ goal, onClose }) {
  const isEdit = !!goal;
  const [name,         setName]         = React.useState(goal ? goal.name : '');
  const [targetAmount, setTargetAmount] = React.useState(goal ? String(goal.targetAmount) : '');
  const [targetDate,   setTargetDate]   = React.useState(goal ? (goal.targetDate || '') : '');
  const [note,         setNote]         = React.useState(goal ? (goal.note || '') : '');
  const [emoji,        setEmoji]        = React.useState(goal ? (goal.emoji || '🎯') : '🎯');

  function save() {
    if (!name || !targetAmount) return;
    const data = { name, targetAmount, targetDate: targetDate || null, note, emoji };
    if (isEdit) Store.updateGoal(goal.id, data);
    else Store.addGoal(data);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit goal' : 'Add financial goal'} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Emoji picker */}
        <div>
          <label className="form-label">Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GOAL_EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                      style={{ fontSize: 22, padding: '4px 8px', borderRadius: 8, border: '2px solid',
                               borderColor: emoji === e ? 'var(--accent)' : 'var(--border-1)',
                               background: emoji === e ? 'var(--accent-bg, rgba(59,130,246,0.1))' : 'transparent',
                               cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Goal name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
                 placeholder="e.g. Down payment, Retire at 55, Europe trip…" autoFocus />
        </div>

        <div>
          <label className="form-label">Target amount (THB) *</label>
          <input type="number" min="0" step="any" value={targetAmount}
                 onChange={e => setTargetAmount(e.target.value)} placeholder="0" />
        </div>

        <div>
          <label className="form-label">Target date (optional)</label>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
        </div>

        <div>
          <label className="form-label">Note</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
                 placeholder="Any extra context…" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={!name || !targetAmount}>
            {isEdit ? 'Save changes' : 'Add goal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Projection helper (simple linear regression on portfolio snapshots) ───────
function useProjectedDate(targetAmount) {
  const snapshots = Store.getSnapshots();
  if (!snapshots || snapshots.length < 7) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  // Use last 90 days for regression
  const recent = sorted.slice(-90);
  const n = recent.length;
  const x0 = new Date(recent[0].date).getTime();
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (const s of recent) {
    const x = (new Date(s.date).getTime() - x0) / 86400000; // days since start
    const y = s.value;
    sumX += x; sumY += y; sumXX += x * x; sumXY += x * y;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  if (slope <= 0) return null; // not growing
  const intercept = (sumY - slope * sumX) / n;
  const lastX = (new Date(recent[n - 1].date).getTime() - x0) / 86400000;
  const daysNeeded = (targetAmount - intercept) / slope;
  if (daysNeeded <= lastX || daysNeeded > 365 * 50) return null;
  const projDate = new Date(x0 + daysNeeded * 86400000);
  return projDate.toISOString().slice(0, 10);
}

function GoalCard({ goal, portfolioValue, onEdit }) {
  const sym      = window.ccySymbol(Store.settings().displayCcy);
  const tgtDisp  = Store.toDisplay(goal.targetAmount, 'THB');
  const progress = tgtDisp > 0 ? Math.min(100, (portfolioValue / tgtDisp) * 100) : 0;
  const remaining = Math.max(0, tgtDisp - portfolioValue);
  const projDate  = useProjectedDate(goal.targetAmount);

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = goal.targetDate
    ? Math.ceil((new Date(goal.targetDate) - new Date()) / 86400000)
    : null;
  const overdue = daysLeft !== null && daysLeft < 0;
  const onTrack = projDate && goal.targetDate ? projDate <= goal.targetDate : null;

  const progressColor = progress >= 100 ? 'var(--green-600)'
    : progress >= 75 ? 'var(--accent)'
    : progress >= 50 ? '#f59e0b'
    : 'var(--red-600)';

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px 12px' }}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>{goal.emoji || '🎯'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}>{goal.name}</span>
            {progress >= 100 && <span style={{ fontSize: 12, color: 'var(--green-600)', background: 'rgba(22,163,74,0.1)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>✓ Reached!</span>}
            {overdue && progress < 100 && <span style={{ fontSize: 12, color: 'var(--red-600)', background: 'rgba(220,38,38,0.1)', padding: '1px 6px', borderRadius: 4 }}>Overdue</span>}
            {!overdue && onTrack === true && <span style={{ fontSize: 12, color: 'var(--green-600)', background: 'rgba(22,163,74,0.1)', padding: '1px 6px', borderRadius: 4 }}>On track</span>}
            {!overdue && onTrack === false && <span style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>Behind</span>}
          </div>
          {goal.note && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 6 }}>{goal.note}</div>}

          {/* Progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>
              <span>Progress: {progress.toFixed(1)}%</span>
              <span>Remaining: {sym}{window.fmtBig(remaining)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
              <div style={{ width: progress + '%', height: '100%', background: progressColor, borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-3)' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 14 }}>{sym}{window.fmtBig(tgtDisp)}</div>
              <div>Target</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: progressColor, fontSize: 14 }}>{sym}{window.fmtBig(portfolioValue)}</div>
              <div>Portfolio</div>
            </div>
            {goal.targetDate && (
              <div>
                <div style={{ fontWeight: 600, color: overdue ? 'var(--red-600)' : 'var(--fg-1)', fontSize: 14 }}>
                  {goal.targetDate}
                </div>
                <div>{daysLeft !== null ? (daysLeft < 0 ? Math.abs(daysLeft) + 'd ago' : daysLeft + 'd left') : ''}</div>
              </div>
            )}
            {projDate && progress < 100 && (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 14 }}>{projDate}</div>
                <div>Projected reach</div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-toggle" onClick={() => onEdit(goal)}><Icon name="edit-2" size={13} /></button>
          <button className="icon-toggle" onClick={() => Store.deleteGoal(goal.id)} style={{ color: 'var(--red-600)' }}><Icon name="trash-2" size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function GoalsView() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const goals    = Store.getGoals();
  const totals   = Store.grandTotals();
  const portValue = totals.value;

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editGoal,  setEditGoal]  = React.useState(null);

  const sorted = [...goals].sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'));
  const reached = sorted.filter(g => portValue >= Store.toDisplay(g.targetAmount, 'THB'));
  const active  = sorted.filter(g => portValue < Store.toDisplay(g.targetAmount, 'THB'));

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Financial Goals</h1>
          <div className="t-small">Track progress toward your financial milestones · projected based on portfolio growth</div>
        </div>
        <Button size="sm" icon="plus" onClick={() => { setEditGoal(null); setModalOpen(true); }}>Add goal</Button>
      </div>

      {goals.length === 0 && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🎯</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No goals yet</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 20 }}>
            Add financial goals to track your progress toward milestones like a home, travel fund, or early retirement.
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>Create your first goal</Button>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div className="t-small" style={{ fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>In progress</div>
          {active.map(g => <GoalCard key={g.id} goal={g} portfolioValue={portValue} onEdit={g => { setEditGoal(g); setModalOpen(true); }} />)}
        </div>
      )}

      {reached.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="t-small" style={{ fontWeight: 700, color: 'var(--green-600)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>Reached ✓</div>
          {reached.map(g => <GoalCard key={g.id} goal={g} portfolioValue={portValue} onEdit={g => { setEditGoal(g); setModalOpen(true); }} />)}
        </div>
      )}

      {modalOpen && (
        <GoalModal goal={editGoal} onClose={() => { setModalOpen(false); setEditGoal(null); }} />
      )}
    </div>
  );
}
