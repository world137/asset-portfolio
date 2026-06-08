/* eslint-disable */
/* NetWorthView.jsx — Total wealth summary: portfolio + cash + liabilities */

function NetWorthLineChart({ snapshots, sym }) {
  if (!snapshots || snapshots.length < 2) return null;
  const data = snapshots.slice(-90); // last 90 days
  const W = 600, H = 120, PAD = 8;
  const vals = data.map(s => s.netWorth);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const range = max - min || 1;

  const x = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);

  const pts = data.map((s, i) => `${x(i)},${y(s.netWorth)}`).join(' ');
  const isPositiveTrend = vals[vals.length - 1] >= vals[0];
  const lineColor = isPositiveTrend ? 'var(--green-600)' : 'var(--red-600)';

  const firstDate = data[0].date;
  const lastDate  = data[data.length - 1].date;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 130, display: 'block' }}>
        {/* Zero line */}
        {min < 0 && max > 0 && (
          <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} stroke="var(--border-1)" strokeWidth="1" strokeDasharray="4 4" />
        )}
        {/* Fill */}
        <path d={`M ${x(0)},${H - PAD} ` + data.map((s, i) => `L ${x(i)},${y(s.netWorth)}`).join(' ') + ` L ${x(data.length - 1)},${H - PAD} Z`}
              fill={lineColor} fillOpacity="0.10" />
        {/* Line */}
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest dot */}
        <circle cx={x(data.length - 1)} cy={y(vals[vals.length - 1])} r="4" fill={lineColor} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  );
}

function NetWorthView() {
  useStore();
  const settings  = Store.settings();
  const sym       = window.ccySymbol(settings.displayCcy);
  const s         = Store.netWorthSummary();
  const snapshots = Store.getWalletSnapshots ? Store.getWalletSnapshots() : [];
  const [hot, setHot] = React.useState(null);

  const liabRatio = s.totalAssets > 0 ? (s.totalLiabilities / s.totalAssets) * 100 : 0;

  // Asset donut segments
  const assetSegs = [
    { label: 'Investments', value: s.portValue,  color: '#2962ab' },
    { label: 'Cash & Accounts', value: s.cashTotal, color: '#1f7a4d' },
  ].filter(sg => sg.value > 0);

  // Liability donut segments
  const liabSegs = [
    { label: 'Credit Card', value: s.creditDebt,  color: '#ef4444' },
    { label: 'Borrowed',    value: s.borrowedDebt, color: '#f97316' },
  ].filter(sg => sg.value > 0);

  const totalAssetVal = assetSegs.reduce((a, s) => a + s.value, 0) || 1;
  const totalLiabVal  = liabSegs.reduce((a, s) => a + s.value, 0) || 0;

  // Full breakdown for the table
  const allRows = [
    { label: 'Investments (Portfolio)', value: s.portValue,   color: '#2962ab', isLiab: false },
    { label: 'Cash & Accounts',         value: s.cashTotal,   color: '#1f7a4d', isLiab: false },
    { label: 'Credit Card Debt',         value: s.creditDebt, color: '#ef4444', isLiab: true  },
    { label: 'Borrowed Debts',           value: s.borrowedDebt, color: '#f97316', isLiab: true },
  ].filter(r => r.value > 0);

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Net Worth</h1>
        <div className="t-small">Total wealth across portfolio, cash accounts, and liabilities · in {settings.displayCcy}</div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi accent">
          <div className="lab">Net Worth</div>
          <div className={'big ' + (s.netWorth >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{window.fmtBig(Math.abs(s.netWorth))}
          </div>
          <div className={'delta ' + (s.netWorth >= 0 ? 'up' : 'down')}>
            {s.netWorth >= 0 ? 'Positive' : 'Negative'}
          </div>
        </div>
        <div className="kpi">
          <div className="lab">Total Assets</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(s.totalAssets)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>Portfolio + Cash</div>
        </div>
        <div className="kpi">
          <div className="lab">Total Liabilities</div>
          <div className="big down"><span className="ccy">{sym}</span>{window.fmtBig(s.totalLiabilities)}</div>
          <div className="delta down">{liabRatio.toFixed(1)}% of assets</div>
        </div>
        <div className="kpi">
          <div className="lab">Asset Coverage</div>
          <div className="big">{s.totalLiabilities > 0 ? (s.totalAssets / s.totalLiabilities).toFixed(1) + '×' : '—'}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>Assets ÷ Liabilities</div>
        </div>
      </div>

      {/* Charts */}
      <div className="dash dash-2col" style={{ marginBottom: 16 }}>
        {/* Asset allocation donut */}
        <div className="card">
          <div className="card-h">
            <div><div className="t">Asset Allocation</div><div className="s">Where your wealth is held</div></div>
          </div>
          <div className="card-b">
            {assetSegs.length === 0 ? (
              <div className="empty">No assets tracked yet.</div>
            ) : (
              <div className="chartwrap">
                <Donut segments={assetSegs} size={188} style={settings.chartStyle}
                       hot={hot} onHover={setHot}
                       center={
                         <React.Fragment>
                           <div className="c-lab">Assets</div>
                           <div className="c-val">{sym}{window.fmtBig(s.totalAssets)}</div>
                         </React.Fragment>
                       } />
                <div className="legend">
                  {assetSegs.map((sg, i) => (
                    <div key={sg.label} className="row"
                         onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                      <span className="sw" style={{ background: sg.color }} />
                      <span className="nm">{sg.label}</span>
                      <span className="vv">{sym}{window.fmtBig(sg.value)}</span>
                      <span className="pc">{((sg.value / totalAssetVal) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Liability breakdown donut */}
        <div className="card">
          <div className="card-h">
            <div><div className="t">Liabilities</div><div className="s">What you owe</div></div>
          </div>
          <div className="card-b">
            {liabSegs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                <div className="t-small">No liabilities — debt-free!</div>
              </div>
            ) : (
              <div className="chartwrap">
                <Donut segments={liabSegs} size={188} style={settings.chartStyle}
                       hot={null} onHover={() => {}}
                       center={
                         <React.Fragment>
                           <div className="c-lab">Owed</div>
                           <div className="c-val down">{sym}{window.fmtBig(totalLiabVal)}</div>
                         </React.Fragment>
                       } />
                <div className="legend">
                  {liabSegs.map((sg, i) => (
                    <div key={sg.label} className="row">
                      <span className="sw" style={{ background: sg.color }} />
                      <span className="nm">{sg.label}</span>
                      <span className="vv down">{sym}{window.fmtBig(sg.value)}</span>
                      <span className="pc">{((sg.value / (totalLiabVal || 1)) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Net worth bar — visual split of assets vs liabilities */}
      {s.totalAssets > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><div className="t">Wealth Breakdown</div></div>
          <div style={{ padding: '0 20px 20px' }}>
            {/* Net worth bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 , marginTop: 6}}>
                <span>Assets <strong style={{ color: 'var(--fg-2)' }}>{sym}{window.fmtBig(s.totalAssets)}</strong></span>
                {s.totalLiabilities > 0 && (
                  <span>Liabilities <strong style={{ color: 'var(--red-600)' }}>{sym}{window.fmtBig(s.totalLiabilities)}</strong></span>
                )}
              </div>
              <div style={{ height: 10, background: 'var(--bg-inset,var(--bg-app))', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                {/* Investments */}
                {s.portValue > 0 && (
                  <div title={'Investments: ' + sym + window.fmtBig(s.portValue)}
                       style={{ width: (s.portValue / (s.totalAssets || 1) * 100) + '%', background: '#2962ab', transition: 'width .4s' }} />
                )}
                {/* Cash */}
                {s.cashTotal > 0 && (
                  <div title={'Cash: ' + sym + window.fmtBig(s.cashTotal)}
                       style={{ width: (s.cashTotal / (s.totalAssets || 1) * 100) + '%', background: '#1f7a4d', transition: 'width .4s' }} />
                )}
              </div>
              {s.totalLiabilities > 0 && (
                <div style={{ height: 5, marginTop: 2, background: 'var(--bg-inset,var(--bg-app))', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: (s.totalLiabilities / (s.totalAssets || 1) * 100) + '%', background: '#ef444466', transition: 'width .4s' }} />
                </div>
              )}
            </div>

            {/* Breakdown table */}
            <table className="ptable" style={{ marginTop: 8 }}>
              <thead><tr>
                <th>Category</th>
                <th className="num">Amount</th>
                <th className="num" style={{ width: 90 }}>% of Assets</th>
              </tr></thead>
              <tbody>
                {allRows.map(r => (
                  <tr key={r.label}>
                    <td>
                      <span className="tk">
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: r.isLiab ? 'var(--red-600)' : 'var(--fg-1)' }}>{r.label}</span>
                        {r.isLiab && <span className="sectorchip" style={{ marginLeft: 6, background: '#ef444422', color: 'var(--red-600)', fontSize: 10 }}>Liability</span>}
                      </span>
                    </td>
                    <td className={'num ' + (r.isLiab ? 'down' : 'up')}>
                      {r.isLiab ? '−' : '+'}{sym}{window.fmtBig(r.value)}
                    </td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>
                      {((r.value / (s.totalAssets || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-2)', fontWeight: 700 }}>
                  <td>Net Worth</td>
                  <td className={'num ' + (s.netWorth >= 0 ? 'up' : 'down')}>
                    {s.netWorth >= 0 ? '+' : '−'}{sym}{window.fmtBig(Math.abs(s.netWorth))}
                  </td>
                  <td className="num" style={{ color: 'var(--fg-3)' }}>
                    {s.totalAssets > 0 ? ((s.netWorth / s.totalAssets) * 100).toFixed(1) + '%' : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Net Worth Trend */}
      {snapshots.length >= 2 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <div><div className="t">Net Worth Trend</div>
              <div className="s">Wallet net worth history (up to 90 days)</div>
            </div>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <NetWorthLineChart snapshots={snapshots} sym={sym} />
            {snapshots.length >= 2 && (() => {
              const first = snapshots[0].netWorth;
              const last  = snapshots[snapshots.length - 1].netWorth;
              const diff  = last - first;
              return (
                <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Period start</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{sym}{window.fmtBig(Math.abs(first))}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Change</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: diff >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>
                      {diff >= 0 ? '+' : '−'}{sym}{window.fmtBig(Math.abs(diff))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Data points</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{snapshots.length} days</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {s.totalAssets === 0 && s.totalLiabilities === 0 && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">
              No data yet. Add holdings in the portfolio, or accounts in the Wallet section.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
