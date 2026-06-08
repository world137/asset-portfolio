/* eslint-disable */
/* WalletSummary.jsx — Wallet income/expense analytics with bar chart + category donuts */

// ── Monthly bar chart (grouped income vs expense) ─────────────────────────────
function MonthlyBarChart({ data, sym }) {
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
  const n      = data.length;
  const W      = n * 72, H = 140;
  const BH     = 90; // bar area height
  const barW   = 22, gap = 4, groupW = barW * 2 + gap;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160, display: 'block' }}>
      {/* grid lines */}
      {[0, 0.5, 1].map((f, i) => {
        const y = H - 36 - f * BH;
        return (
          <g key={i}>
            <line x1={8} x2={W - 8} y1={y} y2={y} stroke="var(--border-1)" strokeWidth="0.6" strokeDasharray="3 5" />
            <text x={6} y={y + 3.5} textAnchor="end" fontSize="8" fill="var(--fg-4)" fontFamily="var(--font-mono)">
              {sym}{window.fmtBig(maxVal * f)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx   = i * 72 + 36;
        const incH = (d.income  / maxVal) * BH;
        const expH = (d.expense / maxVal) * BH;
        const baseY = H - 36;
        return (
          <g key={d.month}>
            {/* income bar */}
            {d.income > 0 && (
              <rect x={cx - groupW / 2} y={baseY - incH} width={barW} height={incH}
                    fill="var(--green-600)" rx={3} opacity={0.85}>
                <title>Income {d.label}: {sym}{window.fmtBig(d.income)}</title>
              </rect>
            )}
            {/* expense bar */}
            {d.expense > 0 && (
              <rect x={cx - groupW / 2 + barW + gap} y={baseY - expH} width={barW} height={expH}
                    fill="var(--red-600)" rx={3} opacity={0.85}>
                <title>Expense {d.label}: {sym}{window.fmtBig(d.expense)}</title>
              </rect>
            )}
            {/* month label */}
            <text x={cx} y={baseY + 12} textAnchor="middle" fontSize="9" fill="var(--fg-3)" fontFamily="var(--font-mono)">
              {d.label}
            </text>
          </g>
        );
      })}
      {/* legend */}
      <g transform={`translate(${W / 2 - 56}, ${H - 14})`}>
        <rect x={0} y={0} width={10} height={10} fill="var(--green-600)" rx={2} opacity={0.85} />
        <text x={14} y={9} fontSize="9" fill="var(--fg-3)">Income</text>
        <rect x={60} y={0} width={10} height={10} fill="var(--red-600)" rx={2} opacity={0.85} />
        <text x={74} y={9} fontSize="9" fill="var(--fg-3)">Expense</text>
      </g>
    </svg>
  );
}

// ── Expense Heatmap (day-of-week × week-of-month) ────────────────────────────
function ExpenseHeatmap({ monthPrefix, transactions, accounts, sym }) {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKS = 5;

  // Compute first day of month
  const [y, m] = monthPrefix.split('-').map(Number);
  const firstDOW = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  // Build day totals
  const dayTotals = {};
  for (const t of transactions) {
    if (!t.date.startsWith(monthPrefix) || t.flow !== 'expense') continue;
    const acc = accounts.find(a => a.id === t.accountId);
    const ccy = acc ? acc.currency : 'THB';
    const amt = Store.walletToDisplay(t.amount, ccy);
    const d = parseInt(t.date.slice(8));
    dayTotals[d] = (dayTotals[d] || 0) + amt;
  }

  const maxVal = Math.max(...Object.values(dayTotals), 1);

  // Grid: rows = weeks, cols = DOW
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const gridDay = i - firstDOW + 1;
    if (gridDay < 1 || gridDay > daysInMonth) return null;
    return gridDay;
  });

  const intensityColor = (val) => {
    if (!val) return 'var(--bg-3)';
    const pct = Math.sqrt(val / maxVal); // sqrt for better visual spread
    const r = Math.round(239 + (220 - 239) * pct);
    const g = Math.round(68  + (30  - 68)  * pct);
    const b = Math.round(68  + (30  - 68)  * pct);
    return `rgba(${r},${g},${b},${0.15 + pct * 0.75})`;
  };

  if (Object.keys(dayTotals).length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Expense Heatmap</div>
      {/* DOW headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg-3)', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const val = dayTotals[day] || 0;
          return (
            <div key={i} title={day + ': ' + (val ? sym + window.fmtBig(val) : 'No expense')}
                 style={{
                   height: 28, borderRadius: 5,
                   background: intensityColor(val),
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   fontSize: 9.5, color: val > maxVal * 0.5 ? '#fff' : 'var(--fg-2)', fontWeight: 600,
                   cursor: 'default',
                 }}>
              {day}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 10, color: 'var(--fg-3)' }}>
        <span>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(p => (
          <div key={p} style={{ width: 14, height: 10, borderRadius: 2, background: intensityColor(p * p * maxVal) }} />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}

// ── Wallet Summary page ───────────────────────────────────────────────────────
function WalletSummary() {
  useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  // Period navigation (default: current month)
  const today    = new Date();
  const [year,  setYear]  = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth() + 1);
  const [hot,   setHot]   = React.useState(null);

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel  = new Date(year, month - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setHot(null);
  };
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const monthly  = Store.walletMonthlyData(6);
  const catData  = Store.walletCategoryData(monthPrefix);
  const thisFlow = Store.monthlyFlow(year, month);
  const net      = thisFlow.income - thisFlow.expense;

  const totalExpense = catData.expense.reduce((s, c) => s + c.value, 0) || 1;
  const totalIncome  = catData.income.reduce((s, c)  => s + c.value, 0) || 1;
  const wallet = Store.getWallet();

  return (
    <div className="page">
      {/* Header with month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Wallet Summary</h1>
          <div className="t-small">Income &amp; expense analytics · {settings.displayCcy}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="icon-toggle" onClick={prevMonth}><Icon name="chev-l" size={15} /></button>
          <span style={{ fontWeight: 600, fontSize: 13, minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
          <button className="icon-toggle" onClick={nextMonth} disabled={isCurrentMonth}
                  style={{ opacity: isCurrentMonth ? 0.35 : 1 }}>
            <Icon name="chev-r" size={15} />
          </button>
        </div>
      </div>

      {/* KPIs for selected month */}
      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi accent">
          <div className="lab">Income</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(thisFlow.income)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{catData.income.length} categories</div>
        </div>
        <div className="kpi">
          <div className="lab">Expense</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(thisFlow.expense)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{catData.expense.length} categories</div>
        </div>
        <div className="kpi">
          <div className="lab">Net Cash Flow</div>
          <div className={'big ' + (net >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{(net >= 0 ? '' : '−') + window.fmtBig(Math.abs(net))}
          </div>
          <div className={'delta ' + (net >= 0 ? 'up' : 'down')}>{net >= 0 ? 'Surplus' : 'Deficit'}</div>
        </div>
        <div className="kpi">
          <div className="lab">Savings Rate</div>
          <div className={'big ' + (thisFlow.income > 0 && net >= 0 ? 'up' : 'down')}>
            {thisFlow.income > 0 ? Math.round((net / thisFlow.income) * 100) + '%' : '—'}
          </div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>of income saved</div>
        </div>
      </div>

      {/* Category donuts */}
      <div className="dash dash-2col" style={{ marginBottom: 16 }}>
        {/* Income by category */}
        <div className="card">
          <div className="card-h">
            <div><div className="t">Income by Category</div><div className="s">{monthLabel}</div></div>
          </div>
          <div className="card-b">
            {catData.income.length === 0 ? (
              <div className="empty">No income transactions this month.</div>
            ) : (
              <div className="chartwrap">
                <Donut segments={catData.income} size={180} style={settings.chartStyle}
                       hot={hot} onHover={setHot}
                       center={
                         <React.Fragment>
                           <div className="c-lab">Income</div>
                           <div className="c-val up">{sym}{window.fmtBig(totalIncome)}</div>
                         </React.Fragment>
                       } />
                <div className="legend">
                  {catData.income.map((c, i) => (
                    <div key={c.label} className="row"
                         onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                      <span className="sw" style={{ background: c.color }} />
                      <span className="nm">{c.label}</span>
                      <span className="vv up">{sym}{window.fmtBig(c.value)}</span>
                      <span className="pc">{((c.value / totalIncome) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expense by category */}
        <div className="card">
          <div className="card-h">
            <div><div className="t">Expense by Category</div><div className="s">{monthLabel}</div></div>
          </div>
          <div className="card-b">
            {catData.expense.length === 0 ? (
              <div className="empty">No expense transactions this month.</div>
            ) : (
              <React.Fragment>
                <div className="chartwrap">
                  <Donut segments={catData.expense} size={180} style={settings.chartStyle}
                         hot={null} onHover={() => {}}
                         center={
                           <React.Fragment>
                             <div className="c-lab">Expense</div>
                             <div className="c-val down">{sym}{window.fmtBig(totalExpense)}</div>
                           </React.Fragment>
                         } />
                  <div className="legend">
                    {catData.expense.map((c, i) => {
                      const cat = wallet.categories.find(wc => wc.name === c.label);
                      const budget = cat ? cat.budget : null;
                      const budgetPct = budget ? Math.min((c.value / budget) * 100, 100) : null;
                      const overBudget = budget && c.value > budget;
                      return (
                        <div key={c.label}>
                          <div className="row">
                            <span className="sw" style={{ background: c.color }} />
                            <span className="nm">{c.label}</span>
                            <span className="vv down">{sym}{window.fmtBig(c.value)}</span>
                            <span className="pc">{((c.value / totalExpense) * 100).toFixed(1)}%</span>
                          </div>
                          {budget != null && (
                            <div style={{ paddingLeft: 16, paddingBottom: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: overBudget ? 'var(--red-600)' : 'var(--fg-4)', marginBottom: 2 }}>
                                <span>{overBudget ? '⚠ Over budget' : `${Math.round(budgetPct)}% of budget`}</span>
                                <span>Budget: {sym}{window.fmtBig(budget)}</span>
                              </div>
                              <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: budgetPct + '%', height: '100%', background: overBudget ? 'var(--red-600)' : budgetPct > 80 ? '#f59e0b' : 'var(--green-600)', borderRadius: 2, transition: 'width .3s' }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                  <ExpenseHeatmap
                    monthPrefix={monthPrefix}
                    transactions={wallet.transactions}
                    accounts={wallet.accounts}
                    sym={sym}
                  />
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>

      {/* 6-month bar chart */}
      <div className="card">
        <div className="card-h">
          <div><div className="t">6-Month Overview</div><div className="s">Monthly income vs expense</div></div>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          {monthly.every(d => d.income === 0 && d.expense === 0) ? (
            <div className="empty" style={{ padding: '32px 0' }}>
              No transactions in the last 6 months.
            </div>
          ) : (
            <MonthlyBarChart data={monthly} sym={sym} />
          )}
        </div>

        {/* Monthly detail table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="ptable">
            <thead><tr>
              <th>Month</th>
              <th className="num">Income</th>
              <th className="num">Expense</th>
              <th className="num">Net</th>
              <th className="num" style={{ width: 90 }}>Savings %</th>
            </tr></thead>
            <tbody>
              {[...monthly].reverse().map(d => {
                const n   = d.income - d.expense;
                const pct = d.income > 0 ? (n / d.income) * 100 : null;
                const isSelected = d.month === monthPrefix;
                return (
                  <tr key={d.month}
                      onClick={() => { const [y, m] = d.month.split('-'); setYear(+y); setMonth(+m); }}
                      style={{ cursor: 'pointer', background: isSelected ? 'var(--bg-hover,var(--bg-inset))' : undefined }}>
                    <td style={{ fontWeight: isSelected ? 700 : 400 }}>
                      {d.label} {d.month.slice(0, 4)}
                      {isSelected && <span className="sectorchip" style={{ marginLeft: 6, fontSize: 10 }}>Selected</span>}
                    </td>
                    <td className="num up">{d.income > 0 ? sym + window.fmtBig(d.income) : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                    <td className="num down">{d.expense > 0 ? sym + window.fmtBig(d.expense) : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                    <td className={'num ' + (n >= 0 ? 'up' : 'down')}>
                      {(n !== 0) ? (n >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(n)) : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                    </td>
                    <td className={'num ' + (pct !== null && pct >= 0 ? 'up' : 'down')}>
                      {pct !== null ? pct.toFixed(1) + '%' : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
