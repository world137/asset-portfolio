/* eslint-disable */
/* DebtTracker.jsx — Lend & Borrow tracker */

function DebtTracker() {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const wallet   = Store.getWallet();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editDebt,  setEditDebt]  = React.useState(null);
  const [tab, setTab]             = React.useState('outstanding'); // 'outstanding' | 'settled'

  const debts    = wallet.debts;
  const summary  = Store.debtSummary();

  const outstanding = debts.filter(d => !d.settled).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
  const settled     = debts.filter(d =>  d.settled).sort((a, b) => b.settledDate?.localeCompare(a.settledDate || '') || 0);
  const displayed   = tab === 'outstanding' ? outstanding : settled;

  const net = summary.totalLent - summary.totalBorrowed;

  // Check overdue
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Debts</h1>
          <div className="t-small">Track money you lent or borrowed</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => { setEditDebt(null); setModalOpen(true); }}>
          Add Debt
        </Button>
      </div>

      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi accent">
          <div className="lab">Total Lent</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(summary.totalLent)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>outstanding</div>
        </div>
        <div className="kpi">
          <div className="lab">Total Borrowed</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(summary.totalBorrowed)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>outstanding</div>
        </div>
        <div className="kpi">
          <div className="lab">Net Position</div>
          <div className={'big ' + (net >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{window.fmtBig(Math.abs(net))}
          </div>
          <div className={'delta ' + (net >= 0 ? 'up' : 'down')}>
            {net >= 0 ? 'Others owe you' : 'You owe others'}
          </div>
        </div>
        <div className="kpi">
          <div className="lab">Outstanding</div>
          <div className="big">{outstanding.length}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{settled.length} settled</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 0 }}>
          <div className="layoutseg" style={{ marginBottom: 0 }}>
            <button className={tab === 'outstanding' ? 'on' : ''} onClick={() => setTab('outstanding')}>
              Outstanding ({outstanding.length})
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
                <th style={{ width: 80 }}>Type</th>
                <th>Person</th>
                <th className="num">Amount</th>
                <th style={{ width: 90 }}>Start</th>
                <th style={{ width: 90 }}>Due / Settled</th>
                <th>Note</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      {tab === 'outstanding' ? 'No outstanding debts.' : 'No settled debts yet.'}
                    </div>
                  </td>
                </tr>
              )}
              {displayed.map(d => {
                const isLent    = d.direction === 'lent';
                const isOverdue = !d.settled && d.dateDue && d.dateDue < today;
                return (
                  <tr key={d.id} onClick={() => { setEditDebt(d); setModalOpen(true); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="sectorchip"
                            style={{
                              background: isLent ? 'var(--green-600)22' : 'var(--red-600)22',
                              color: isLent ? 'var(--green-600)' : 'var(--red-600)',
                            }}>
                        {isLent ? 'Lent' : 'Borrowed'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{d.counterparty}</td>
                    <td className="num" style={{ fontWeight: 600, color: isLent ? 'var(--green-600)' : 'var(--red-600)' }}>
                      {window.fmtCcy(d.amount, d.currency)}
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
                    <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>{d.note || ''}</td>
                    <td>
                      <Button variant="ghost" size="sm" icon="edit"
                              onClick={e => { e.stopPropagation(); setEditDebt(d); setModalOpen(true); }} />
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
    </div>
  );
}
