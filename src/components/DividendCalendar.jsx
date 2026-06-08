/* eslint-disable */
/* DividendCalendar.jsx — Feature #2: Dividend / Income Calendar */

// ── Modal ─────────────────────────────────────────────────────────────────────
function DividendModal({ item, onClose }) {
  const isEdit = !!item;
  const allPos = [];
  for (const cls of window.ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      allPos.push({ label: `${cls.short} · ${p.name}`, classKey: cls.key, name: p.name, qty: p.qty, ccy: cls.ccy });
    }
  }

  const [classKey,        setClassKey]        = React.useState(item ? item.classKey : '');
  const [name,            setName]            = React.useState(item ? item.name : '');
  const [exDate,          setExDate]          = React.useState(item ? (item.exDate || '') : '');
  const [payDate,         setPayDate]         = React.useState(item ? (item.payDate || '') : '');
  const [amountPerShare,  setAmountPerShare]  = React.useState(item ? (item.amountPerShare || '') : '');
  const [totalAmount,     setTotalAmount]     = React.useState(item ? (item.totalAmount || '') : '');
  const [currency,        setCurrency]        = React.useState(item ? (item.currency || 'THB') : 'THB');
  const [note,            setNote]            = React.useState(item ? (item.note || '') : '');

  const selectedPos = allPos.find(p => p.classKey === classKey && p.name === name);

  // Auto-calc total from per-share amount
  const calcTotal = amountPerShare && selectedPos
    ? (parseFloat(amountPerShare) * selectedPos.qty).toFixed(2)
    : '';

  function handleSelectPos(val) {
    const p = allPos.find(p => p.label === val);
    if (p) { setClassKey(p.classKey); setName(p.name); setCurrency(p.ccy); }
  }

  function save() {
    if (!name || !payDate) return;
    const data = { classKey, name, exDate: exDate || null, payDate, currency, note,
      amountPerShare: amountPerShare || null,
      totalAmount: totalAmount || calcTotal || null };
    if (isEdit) Store.updateDividend(item.id, data);
    else Store.addDividend(data);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit dividend entry' : 'Add dividend / income'} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="form-label">Holding</label>
          <input list="div-pos-list" placeholder="Search holding…" defaultValue={name ? (allPos.find(p => p.classKey === classKey && p.name === name) || {}).label || name : ''}
                 onChange={e => handleSelectPos(e.target.value)} />
          <datalist id="div-pos-list">
            {allPos.map(p => <option key={p.classKey + ':' + p.name} value={p.label} />)}
          </datalist>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-label">Ex-dividend date</label>
            <input type="date" value={exDate} onChange={e => setExDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Pay date *</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-label">Amount per share</label>
            <input type="number" min="0" step="any" value={amountPerShare} onChange={e => setAmountPerShare(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="form-label">Total amount {calcTotal ? <span style={{ color: 'var(--accent)', fontSize: 11 }}>= {calcTotal}</span> : ''}</label>
            <input type="number" min="0" step="any" value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
                   placeholder={calcTotal || '0.00'} />
          </div>
        </div>

        <div>
          <label className="form-label">Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="THB">THB</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div>
          <label className="form-label">Note</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Q3 dividend, fund distribution…" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={!name || !payDate}>
            {isEdit ? 'Save changes' : 'Add dividend'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
function DividendCalendar() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const dividends = Store.getDividends();

  const [modalOpen,   setModalOpen]   = React.useState(false);
  const [editItem,    setEditItem]    = React.useState(null);
  const [viewMonth,   setViewMonth]   = React.useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  const [tab, setTab] = React.useState('calendar'); // 'calendar' | 'list' | 'summary'

  const [year, mon] = viewMonth.split('-').map(Number);

  function changeMonth(delta) {
    const d = new Date(year, mon - 1 + delta, 1);
    setViewMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  // All dividends sorted by payDate
  const sorted = [...dividends].sort((a, b) => (a.payDate || '').localeCompare(b.payDate || ''));

  // This month's dividends
  const monthPrefix = viewMonth;
  const thisMonth   = sorted.filter(d => (d.payDate || '').startsWith(monthPrefix));

  // Year totals (THB)
  const USDTHB = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;
  function toTHB(amount, ccy) {
    return ccy === 'USD' ? (amount || 0) * USDTHB : (amount || 0);
  }
  function toDisplay(amount, ccy) {
    return Store.toDisplay(toTHB(amount, ccy), 'THB');
  }

  function effectiveAmount(d) {
    const raw = d.totalAmount || (d.amountPerShare ? d.amountPerShare * ((Store.positions(d.classKey).find(p => p.name === d.name) || {}).qty || 0) : 0);
    return toDisplay(raw, d.currency);
  }

  const totalThisMonth = thisMonth.reduce((a, d) => a + effectiveAmount(d), 0);

  // Calendar grid
  const firstDay  = new Date(year, mon - 1, 1).getDay(); // 0=Sun
  const daysInMon = new Date(year, mon, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function payLabel(d) {
    return d.name + (d.totalAmount ? ` · ${sym}${window.fmtBig(effectiveAmount(d))}` : '');
  }

  // Annual summary by ticker
  const curYear = new Date().getFullYear();
  const yearDivs = sorted.filter(d => (d.payDate || '').startsWith(String(curYear)));
  const tickerMap = new Map();
  for (const d of yearDivs) {
    const key = d.classKey + ':' + d.name;
    const amt = effectiveAmount(d);
    if (!tickerMap.has(key)) tickerMap.set(key, { name: d.name, classKey: d.classKey, total: 0, count: 0 });
    const e = tickerMap.get(key);
    e.total += amt; e.count++;
  }
  const tickerRows = [...tickerMap.values()].sort((a, b) => b.total - a.total);
  const yearTotal  = tickerRows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Dividend Calendar</h1>
          <div className="t-small">Track dividends, fund distributions, and other income from holdings</div>
        </div>
        <Button size="sm" icon="plus" onClick={() => { setEditItem(null); setModalOpen(true); }}>Add entry</Button>
      </div>

      {/* Tab bar */}
      <div className="layoutseg" style={{ marginBottom: 16 }}>
        <button className={tab === 'calendar' ? 'on' : ''} onClick={() => setTab('calendar')}>Calendar</button>
        <button className={tab === 'list'     ? 'on' : ''} onClick={() => setTab('list')}>All entries</button>
        <button className={tab === 'summary'  ? 'on' : ''} onClick={() => setTab('summary')}>Annual summary</button>
      </div>

      {/* ── CALENDAR TAB ─────────────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <React.Fragment>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button className="icon-toggle" onClick={() => changeMonth(-1)}><Icon name="chevron-left" size={16} /></button>
            <span style={{ fontWeight: 700, fontSize: 16, minWidth: 160, textAlign: 'center' }}>
              {MONTHS[mon - 1]} {year}
            </span>
            <button className="icon-toggle" onClick={() => changeMonth(1)}><Icon name="chevron-right" size={16} /></button>
            {totalThisMonth > 0 && (
              <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--green-600)', fontWeight: 600 }}>
                Income: {sym}{window.fmtBig(totalThisMonth)}
              </span>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-1)' }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-3)' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={'e' + i} style={{ minHeight: 70, borderRight: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)' }} />;
                const dayStr = viewMonth + '-' + String(day).padStart(2, '0');
                const dayDivs = sorted.filter(d => d.payDate === dayStr || d.exDate === dayStr);
                const isToday = dayStr === new Date().toISOString().slice(0, 10);
                return (
                  <div key={day} style={{
                    minHeight: 70, padding: '6px 4px',
                    borderRight: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)',
                    background: isToday ? 'var(--accent-bg, rgba(59,130,246,0.07))' : 'transparent',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--fg-3)', marginBottom: 3 }}>{day}</div>
                    {dayDivs.map(d => (
                      <div key={d.id} title={payLabel(d)}
                           style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, marginBottom: 2,
                             background: d.payDate === dayStr ? 'var(--green-600)' : 'var(--fg-4)',
                             color: '#fff', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                           onClick={() => { setEditItem(d); setModalOpen(true); }}>
                        {d.payDate === dayStr ? '💰 ' : '📋 '}{d.name.replace(/THB$/, '')}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {thisMonth.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--fg-3)', padding: '24px 0', fontSize: 13 }}>
              No dividends scheduled this month.
            </div>
          )}
        </React.Fragment>
      )}

      {/* ── LIST TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <div className="card">
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="ptable">
              <thead>
                <tr>
                  <th>Holding</th>
                  <th className="num">Ex-Date</th>
                  <th className="num">Pay Date</th>
                  <th className="num">Per Share</th>
                  <th className="num">Total</th>
                  <th className="num">Currency</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={8}><div className="empty">No dividend entries yet. Click "Add entry" to start.</div></td></tr>
                )}
                {sorted.map(d => {
                  const cls = window.ASSET_CLASSES.find(c => c.key === d.classKey);
                  const amt = effectiveAmount(d);
                  return (
                    <tr key={d.id} className="pos">
                      <td>
                        <span className="tk">
                          <span className="av" style={{ background: cls ? window.CLASS_COLORS[cls.key] : '#888', borderRadius: 7, fontSize: 9 }}>
                            {(cls ? cls.short : '?').slice(0, 3)}
                          </span>
                          <span style={{ fontWeight: 600 }}>{d.name.replace(/THB$/, '')}</span>
                        </span>
                      </td>
                      <td className="num" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{d.exDate || '—'}</td>
                      <td className="num" style={{ fontWeight: 600, fontSize: 12 }}>{d.payDate}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{d.amountPerShare ? window.fmtPrice(d.amountPerShare, d.currency) : '—'}</td>
                      <td className="num up">{amt ? sym + window.fmtBig(amt) : '—'}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{d.currency}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{d.note || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="icon-toggle" onClick={() => { setEditItem(d); setModalOpen(true); }}><Icon name="edit-2" size={13} /></button>
                          <button className="icon-toggle" onClick={() => Store.deleteDividend(d.id)} style={{ color: 'var(--red-600)' }}><Icon name="trash-2" size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUMMARY TAB ──────────────────────────────────────────────────────── */}
      {tab === 'summary' && (
        <React.Fragment>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi accent">
              <div className="lab">Total Income {curYear}</div>
              <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(yearTotal)}</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>{yearDivs.length} entries</div>
            </div>
            <div className="kpi">
              <div className="lab">Monthly Avg</div>
              <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(yearTotal / 12)}</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>{new Date().getFullYear()}</div>
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h"><div className="t">Monthly income {curYear}</div></div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Income</th>
                    <th className="num">Entries</th>
                    <th>Holdings</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m   = String(i + 1).padStart(2, '0');
                    const pfx = curYear + '-' + m;
                    const mDivs = sorted.filter(d => (d.payDate || '').startsWith(pfx));
                    const mAmt  = mDivs.reduce((a, d) => a + effectiveAmount(d), 0);
                    return (
                      <tr key={m} className="pos" style={{ opacity: mDivs.length === 0 ? 0.5 : 1 }}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[i]}</td>
                        <td className={'num ' + (mAmt > 0 ? 'up' : '')}>{mAmt > 0 ? sym + window.fmtBig(mAmt) : '—'}</td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{mDivs.length || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{mDivs.map(d => d.name.replace(/THB$/, '')).join(', ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">By holding {curYear}</div></div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Holding</th>
                    <th className="num">Total Income</th>
                    <th className="num">Entries</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {tickerRows.length === 0 && <tr><td colSpan={4}><div className="empty">No data for {curYear}.</div></td></tr>}
                  {tickerRows.map(r => (
                    <tr key={r.classKey + ':' + r.name} className="pos">
                      <td>
                        <span className="tk">
                          <span className="av" style={{ background: window.CLASS_COLORS[r.classKey] || '#888', borderRadius: 7, fontSize: 9 }}>
                            {(window.ASSET_CLASSES.find(c => c.key === r.classKey) || {}).short || '?'}
                          </span>
                          <span style={{ fontWeight: 600 }}>{r.name.replace(/THB$/, '')}</span>
                        </span>
                      </td>
                      <td className="num up">{sym}{window.fmtBig(r.total)}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{r.count}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>
                        {yearTotal > 0 ? ((r.total / yearTotal) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </React.Fragment>
      )}

      {(modalOpen) && (
        <DividendModal
          item={editItem}
          onClose={() => { setModalOpen(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}
