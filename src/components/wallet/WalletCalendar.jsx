/* eslint-disable */
/* WalletCalendar.jsx — Monthly calendar view of income / expense transactions */

function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < breakpoint);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [breakpoint]);
  return mobile;
}

function WalletCalendar() {
  useStore();
  const wallet   = Store.getWallet();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const isMobile = useIsMobile(700);

  const now = new Date();
  const [year,  setYear]  = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth() + 1); // 1-based
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [txModal, setTxModal]         = React.useState(false);

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const bills = wallet.bills || [];
  const activeBills = bills.filter(b => b.active);

  // Build a map: { 'YYYY-MM-DD': { income, expense, txns[] } }
  const dayMap = React.useMemo(() => {
    const map = {};
    for (const t of wallet.transactions) {
      if (!t.date.startsWith(monthPrefix)) continue;
      const acc  = wallet.accounts.find(a => a.id === t.accountId);
      const ccy  = acc ? acc.currency : 'THB';
      const amt  = Store.walletToDisplay(t.amount, ccy);
      if (!map[t.date]) map[t.date] = { income: 0, expense: 0, txns: [] };
      if (t.flow === 'income')  map[t.date].income  += amt;
      if (t.flow === 'expense') map[t.date].expense += amt;
      if (t.flow !== 'transfer') map[t.date].txns.push(t);
    }
    return map;
  }, [wallet.transactions, monthPrefix]);

  // Month navigation helpers
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else             { setMonth(m => m - 1); }
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else              { setMonth(m => m + 1); }
    setSelectedDay(null);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDay(null);
  };

  // Calendar grid
  const firstDay  = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr  = now.toISOString().slice(0, 10);
  const monthName = new Date(year, month - 1, 1).toLocaleString('en', { month: 'long' });

  // Monthly totals
  const monthIncome  = Object.values(dayMap).reduce((s, d) => s + d.income,  0);
  const monthExpense = Object.values(dayMap).reduce((s, d) => s + d.expense, 0);

  // Selected day transactions
  const selDateStr = selectedDay
    ? `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selData = selDateStr ? (dayMap[selDateStr] || { income: 0, expense: 0, txns: [] }) : null;

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Calendar</h1>
          <div className="t-small">Daily income &amp; expense for {monthName} {year}</div>
        </div>
        <Button variant="accent" icon="plus" onClick={() => { setSelectedDay(now.getDate()); setTxModal(true); }}>
          Add Transaction
        </Button>
      </div>

      {/* Month KPIs */}
      <div className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="lab">Income This Month</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(monthIncome)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Expense This Month</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(monthExpense)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Net</div>
          {(() => {
            const net = monthIncome - monthExpense;
            return (
              <div className={'big ' + (net >= 0 ? 'up' : 'down')}>
                <span className="ccy">{sym}</span>
                {(net >= 0 ? '' : '−') + window.fmtBig(Math.abs(net))}
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedDay && !isMobile ? '1fr 320px' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* Calendar card */}
        <div className="card">
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border-1)' }}>
            <button className="icon-toggle" onClick={prevMonth} title="Previous month">
              <Icon name="chevron-left" size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{monthName} {year}</span>
              {(year !== now.getFullYear() || month !== now.getMonth() + 1) && (
                <button className="icon-toggle" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, height: 'auto' }}
                        onClick={goToday}>Today</button>
              )}
            </div>
            <button className="icon-toggle" onClick={nextMonth} title="Next month">
              <Icon name="chevron-right" size={16} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 8px 0' }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 8px 12px', gap: 2 }}>
            {/* Leading empty cells */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={'e' + i} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day      = i + 1;
              const dateStr  = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data     = dayMap[dateStr];
              const isToday  = dateStr === todayStr;
              const isSel    = selectedDay === day;
              const dayBills = activeBills.filter(b => b.dueDay === day);
              const billDueToday = dayBills.length > 0;

              return (
                <div key={day}
                     onClick={() => setSelectedDay(isSel ? null : day)}
                     style={{
                       minHeight: 58,
                       borderRadius: 8,
                       padding: '5px 6px',
                       cursor: 'pointer',
                       border: isSel ? '2px solid var(--accent)' : billDueToday ? '2px solid #f59e0b66' : '2px solid transparent',
                       background: isSel ? 'var(--accent)11' : isToday ? 'var(--bg-inset,var(--bg-app))' : billDueToday ? '#f59e0b09' : 'transparent',
                       transition: 'background .15s',
                     }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--fg-1)',
                      lineHeight: 1, marginBottom: 4,
                    }}>
                      {day}
                    </div>
                    {billDueToday && (
                      <div title={dayBills.map(b => b.name).join(', ')}
                           style={{ fontSize: 9, background: '#f59e0b', color: '#fff', borderRadius: 3,
                                    padding: '1px 4px', fontWeight: 700, lineHeight: 1.4, flexShrink: 0 }}>
                        Bill{dayBills.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {data && data.income > 0 && (
                    <div style={{ fontSize: 9.5, color: 'var(--green-600)', fontWeight: 600, lineHeight: 1.3, fontFamily: 'var(--font-mono)' }}>
                      +{window.fmtBig(data.income)}
                    </div>
                  )}
                  {data && data.expense > 0 && (
                    <div style={{ fontSize: 9.5, color: 'var(--red-600)', fontWeight: 600, lineHeight: 1.3, fontFamily: 'var(--font-mono)' }}>
                      −{window.fmtBig(data.expense)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day detail panel */}
        {selectedDay && selData && (
          <div className="card" style={{ position: 'sticky', top: 72 }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {new Date(year, month - 1, selectedDay).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                  {selData.txns.length} transaction{selData.txns.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button className="icon-toggle" onClick={() => setSelectedDay(null)}>
                <Icon name="x" size={15} />
              </button>
            </div>

            {selData.txns.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
                No transactions on this day.
              </div>
            ) : (
              <div style={{ padding: '8px 0', maxHeight: 420, overflowY: 'auto' }}>
                {selData.txns.map(t => {
                  const acc = wallet.accounts.find(a => a.id === t.accountId);
                  const cat = wallet.categories.find(c => c.id === t.categoryId);
                  const ccy = acc ? acc.currency : 'THB';
                  return (
                    <div key={t.id} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: t.flow === 'income' ? 'var(--green-600)' : 'var(--red-600)',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.note || (cat ? cat.name : t.flow)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                          {acc ? acc.name : '—'}{cat ? ' · ' + cat.name : ''}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: t.flow === 'income' ? 'var(--green-600)' : 'var(--red-600)',
                        flexShrink: 0,
                      }}>
                        {t.flow === 'income' ? '+' : '−'}{window.fmtCcy(t.amount, ccy)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selData.txns.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                {selData.income > 0 && (
                  <span style={{ color: 'var(--green-600)', fontWeight: 600 }}>+{sym}{window.fmtBig(selData.income)}</span>
                )}
                {selData.expense > 0 && (
                  <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>−{sym}{window.fmtBig(selData.expense)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <TransactionModal open={txModal} onClose={() => setTxModal(false)} />
    </div>
  );
}
