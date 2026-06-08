/* eslint-disable */
/* RiskView.jsx — Features #6-10: Sharpe/Sortino, Max Drawdown, Correlation, Stress Test, Yield on Cost */

// ── Math helpers ───────────────────────────────────────────────────────────────
function computeReturns(values) {
  const out = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) out.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  return out;
}

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, x) => a + (x - m) ** 2, 0) / (arr.length - 1));
}

function sharpe(returns, riskFree = 0) {
  if (returns.length < 2) return null;
  const m = mean(returns);
  const s = stddev(returns);
  if (s === 0) return null;
  const annualFactor = Math.sqrt(252);
  return ((m - riskFree / 252) / s) * annualFactor;
}

function sortino(returns, riskFree = 0) {
  if (returns.length < 2) return null;
  const m = mean(returns);
  const downside = returns.filter(r => r < 0);
  if (downside.length === 0) return null;
  const ds = Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / downside.length);
  if (ds === 0) return null;
  const annualFactor = Math.sqrt(252);
  return ((m - riskFree / 252) / ds) * annualFactor;
}

function maxDrawdown(values) {
  let peak = -Infinity, maxDD = 0, peakDate = null, troughDate = null, peakDateTmp = null;
  for (const v of values) {
    if (v > peak) { peak = v; peakDateTmp = v; }
    const dd = peak > 0 ? (v - peak) / peak : 0;
    if (dd < maxDD) { maxDD = dd; }
  }
  return maxDD * 100; // as percentage (negative)
}

function correlation(xArr, yArr) {
  const n = Math.min(xArr.length, yArr.length);
  if (n < 3) return null;
  const xs = xArr.slice(-n), ys = yArr.slice(-n);
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx  += (xs[i] - mx) ** 2;
    dy  += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : num / denom;
}

// ── Risk Metrics component ─────────────────────────────────────────────────────
function RiskView() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const snapshots = Store.getSnapshots();
  const [tab, setTab] = React.useState('overview');

  const sorted = [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  const portValues = sorted.map(s => s.value);
  const portReturns = computeReturns(portValues);

  // ── Feature #6: Sharpe & Sortino ────────────────────────────────────────────
  const sharpeRatio  = sharpe(portReturns);
  const sortinoRatio = sortino(portReturns);
  const annualReturn = portReturns.length >= 2
    ? (Math.pow(portValues[portValues.length - 1] / portValues[0], 252 / portReturns.length) - 1) * 100
    : null;
  const volAnnual = stddev(portReturns) * Math.sqrt(252) * 100;

  // ── Feature #7: Max Drawdown ─────────────────────────────────────────────────
  const maxDD = maxDrawdown(portValues);
  const calmarRatio = maxDD !== 0 && annualReturn !== null ? annualReturn / Math.abs(maxDD) : null;

  // Drawdown series
  let peakVal = -Infinity;
  const ddSeries = sorted.map(s => {
    if (s.value > peakVal) peakVal = s.value;
    return { date: s.date, dd: peakVal > 0 ? (s.value - peakVal) / peakVal * 100 : 0 };
  });

  // ── Feature #8: Correlation matrix ──────────────────────────────────────────
  const classes = window.ASSET_CLASSES.filter(cls =>
    sorted.some(s => s[cls.key] != null && s[cls.key] > 0)
  );

  const classReturns = {};
  for (const cls of classes) {
    const vals = sorted.map(s => s[cls.key] || 0).filter((_, i) => sorted[i][cls.key] != null);
    classReturns[cls.key] = computeReturns(sorted.map(s => s[cls.key] || 0));
  }

  // ── Feature #9: Stress test ─────────────────────────────────────────────────
  const SCENARIOS = [
    { label: 'Mild correction',      pct: -10, desc: 'Minor market correction' },
    { label: '2020 COVID crash',      pct: -34, desc: 'Feb-Mar 2020 S&P 500 drop' },
    { label: 'Bear market',           pct: -50, desc: 'Typical bear market peak-to-trough' },
    { label: '2008 GFC',              pct: -57, desc: '2008 Global Financial Crisis (S&P 500)' },
    { label: 'Thai 1997 crisis',      pct: -75, desc: '1997 Tom Yum Goong crisis (SET Index)' },
    { label: 'Crypto winter',         pct: -80, desc: '2022-style crypto winter' },
  ];
  const currentValue = Store.grandTotals().value;

  // Custom scenario
  const [customPct, setCustomPct] = React.useState('-30');

  // ── Feature #10: Yield on Cost ──────────────────────────────────────────────
  const yocRows = [];
  for (const cls of window.ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      const divs = Store.getDividends().filter(d => d.classKey === cls.key && d.name === p.name);
      const totalDivIncome = divs.reduce((a, d) => {
        const raw = d.totalAmount || (d.amountPerShare ? d.amountPerShare * p.qty : 0);
        return a + Store.toDisplay(cls.ccy === 'USD' ? raw * (Store.get().fx.USDTHB || 34.5) : raw, 'THB');
      }, 0);
      const costDisp = Store.toDisplay(p.cost, cls.ccy);
      const valDisp  = Store.toDisplay(p.value, cls.ccy);
      const yoc      = costDisp > 0 ? (totalDivIncome / costDisp) * 100 : 0;
      const curYield = valDisp  > 0 ? (totalDivIncome / valDisp)  * 100 : 0;
      if (divs.length > 0 || p.value > 0) {
        yocRows.push({ cls, name: p.name, cost: costDisp, value: valDisp, totalDivIncome, yoc, curYield });
      }
    }
  }
  yocRows.sort((a, b) => b.yoc - a.yoc);

  function ratioColor(v, goodThresh, badThresh) {
    if (v === null) return 'var(--fg-3)';
    if (v >= goodThresh) return 'var(--green-600)';
    if (v <= badThresh)  return 'var(--red-600)';
    return '#f59e0b';
  }

  const hasData = sorted.length >= 7;

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Risk Analysis</h1>
        <div className="t-small">Portfolio risk metrics, drawdown analysis, correlation, stress tests, and yield on cost</div>
      </div>

      <div className="layoutseg" style={{ marginBottom: 18 }}>
        <button className={tab === 'overview'     ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'drawdown'     ? 'on' : ''} onClick={() => setTab('drawdown')}>Drawdown</button>
        <button className={tab === 'correlation'  ? 'on' : ''} onClick={() => setTab('correlation')}>Correlation</button>
        <button className={tab === 'stress'       ? 'on' : ''} onClick={() => setTab('stress')}>Stress Test</button>
        <button className={tab === 'yoc'          ? 'on' : ''} onClick={() => setTab('yoc')}>Yield on Cost</button>
      </div>

      {!hasData && tab !== 'stress' && tab !== 'yoc' && (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Not enough history</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>
            Risk metrics need at least 7 daily snapshots. Come back after a few more days!
          </div>
        </div>
      )}

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {tab === 'overview' && hasData && (
        <React.Fragment>
          <div className="kpis" style={{ marginBottom: 18 }}>
            {[
              { label: 'Sharpe Ratio',    value: sharpeRatio,  fmt: v => v.toFixed(2),  color: ratioColor(sharpeRatio,  1, 0),   tip: '>1 good · >2 very good · risk-adjusted return' },
              { label: 'Sortino Ratio',   value: sortinoRatio, fmt: v => v.toFixed(2),  color: ratioColor(sortinoRatio, 2, 0),   tip: 'Like Sharpe but only penalizes downside volatility' },
              { label: 'Max Drawdown',    value: maxDD,        fmt: v => v.toFixed(1) + '%', color: maxDD > -10 ? 'var(--green-600)' : maxDD > -25 ? '#f59e0b' : 'var(--red-600)', tip: 'Largest peak-to-trough loss' },
              { label: 'Calmar Ratio',    value: calmarRatio,  fmt: v => v.toFixed(2),  color: ratioColor(calmarRatio,  1, 0),   tip: 'Annual return / Max drawdown' },
              { label: 'Annual Return',   value: annualReturn, fmt: v => v.toFixed(1) + '%', color: annualReturn !== null ? (annualReturn >= 0 ? 'var(--green-600)' : 'var(--red-600)') : 'var(--fg-3)', tip: 'Annualized portfolio return' },
              { label: 'Annual Vol',      value: volAnnual,    fmt: v => v.toFixed(1) + '%', color: volAnnual < 10 ? 'var(--green-600)' : volAnnual < 25 ? '#f59e0b' : 'var(--red-600)', tip: 'Annualized daily volatility' },
            ].map(m => (
              <div key={m.label} className="kpi" title={m.tip}>
                <div className="lab">{m.label}</div>
                <div className="big" style={{ color: m.value !== null ? m.color : 'var(--fg-3)', fontSize: 22 }}>
                  {m.value !== null ? m.fmt(m.value) : '—'}
                </div>
                <div className="delta" style={{ color: 'var(--fg-3)', fontSize: 10 }}>{m.tip.split('·')[0].trim()}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Metric Guide</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, fontSize: 12, color: 'var(--fg-3)' }}>
              <div><strong style={{ color: 'var(--fg-1)' }}>Sharpe Ratio:</strong> Return per unit of total risk. &gt;1 = good, &gt;2 = excellent.</div>
              <div><strong style={{ color: 'var(--fg-1)' }}>Sortino Ratio:</strong> Like Sharpe but only downside risk counts. &gt;2 = very good.</div>
              <div><strong style={{ color: 'var(--fg-1)' }}>Max Drawdown:</strong> Biggest loss from a peak. Smaller is better.</div>
              <div><strong style={{ color: 'var(--fg-1)' }}>Calmar Ratio:</strong> Annual return / Max Drawdown. &gt;1 = good risk/return trade-off.</div>
              <div><strong style={{ color: 'var(--fg-1)' }}>Annual Volatility:</strong> Standard deviation of daily returns × √252. Lower = smoother ride.</div>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ── DRAWDOWN TAB ──────────────────────────────────────────────────── */}
      {tab === 'drawdown' && hasData && (
        <React.Fragment>
          <div className="kpis" style={{ marginBottom: 18 }}>
            <div className="kpi" style={{ borderColor: 'var(--red-600)' }}>
              <div className="lab">Max Drawdown</div>
              <div className="big" style={{ color: 'var(--red-600)' }}>{maxDD.toFixed(1)}%</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>Peak to trough</div>
            </div>
            <div className="kpi">
              <div className="lab">Current Drawdown</div>
              {(() => {
                const cur = ddSeries.length ? ddSeries[ddSeries.length - 1].dd : 0;
                return <React.Fragment>
                  <div className="big" style={{ color: cur < -1 ? 'var(--red-600)' : 'var(--green-600)' }}>{cur.toFixed(1)}%</div>
                  <div className="delta" style={{ color: 'var(--fg-3)' }}>{cur >= -0.1 ? 'At all-time high' : 'Below ATH'}</div>
                </React.Fragment>;
              })()}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">Drawdown Chart</div><div className="s">% below running peak · 0% = all-time high</div></div>
            <div style={{ padding: '12px 12px 8px', overflowX: 'auto' }}>
              <svg viewBox={'0 0 800 160'} style={{ width: '100%', display: 'block' }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dd-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(220,38,38,0.5)" />
                    <stop offset="100%" stopColor="rgba(220,38,38,0.05)" />
                  </linearGradient>
                </defs>
                {ddSeries.length > 1 && (() => {
                  const n = ddSeries.length;
                  const minDD = Math.min(...ddSeries.map(d => d.dd), -0.1);
                  const xOf = i => (i / (n - 1)) * 800;
                  const yOf = v => 10 + ((v - 0) / (minDD - 0)) * 140;
                  const pathPts = ddSeries.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(d.dd)}`).join(' ');
                  const areaPath = `${pathPts} L800,10 L0,10 Z`;
                  return (
                    <React.Fragment>
                      <path d={areaPath} fill="url(#dd-grad)" />
                      <path d={pathPts} fill="none" stroke="rgba(220,38,38,0.8)" strokeWidth="1.5" />
                      <line x1="0" y1="10" x2="800" y2="10" stroke="rgba(22,163,74,0.4)" strokeWidth="1" strokeDasharray="4,3" />
                    </React.Fragment>
                  );
                })()}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
                <span>{sorted[0]?.date}</span>
                <span>{sorted[sorted.length - 1]?.date}</span>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ── CORRELATION TAB ───────────────────────────────────────────────── */}
      {tab === 'correlation' && hasData && (
        <div className="card">
          <div className="card-h">
            <div className="t">Asset Class Correlation Matrix</div>
            <div className="s">Based on daily returns from snapshot history · closer to 0 = more diversified</div>
          </div>
          {classes.length < 2 ? (
            <div style={{ padding: '24px 18px', color: 'var(--fg-3)', fontSize: 13 }}>
              Need at least 2 asset classes with history to show correlation.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 0 16px' }}>
              <table style={{ borderCollapse: 'collapse', margin: '0 auto', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', color: 'var(--fg-3)' }} />
                    {classes.map(cls => (
                      <th key={cls.key} style={{ padding: '8px 10px', color: 'var(--fg-2)', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: 'column' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: window.CLASS_COLORS[cls.key], display: 'inline-block' }} />
                          <span>{cls.short}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map(rowCls => (
                    <tr key={rowCls.key}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: window.CLASS_COLORS[rowCls.key], flexShrink: 0 }} />
                          {rowCls.label}
                        </span>
                      </td>
                      {classes.map(colCls => {
                        const r = rowCls.key === colCls.key ? 1 :
                          correlation(classReturns[rowCls.key] || [], classReturns[colCls.key] || []);
                        const v = r !== null ? r : 0;
                        // Color: green for negative (good diversification), red for positive (concentrated)
                        const absV = Math.abs(v);
                        let bg;
                        if (rowCls.key === colCls.key) {
                          bg = 'var(--bg-sunken)';
                        } else if (v >= 0.7) {
                          bg = 'rgba(220,38,38,' + (0.15 + absV * 0.4) + ')';
                        } else if (v >= 0.3) {
                          bg = 'rgba(245,158,11,' + (0.1 + absV * 0.3) + ')';
                        } else if (v >= 0) {
                          bg = 'rgba(128,128,128,0.05)';
                        } else {
                          bg = 'rgba(22,163,74,' + (0.1 + absV * 0.4) + ')';
                        }
                        return (
                          <td key={colCls.key} style={{
                            padding: '10px 14px', textAlign: 'center', fontWeight: rowCls.key === colCls.key ? 700 : 400,
                            background: bg, borderRadius: 0, color: r === null ? 'var(--fg-4)' : 'var(--fg-1)',
                          }}>
                            {r === null ? '—' : v.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px 18px', fontSize: 11, color: 'var(--fg-3)' }}>
                🟢 Green = negative correlation (diversification benefit) · 🔴 Red = high positive correlation (concentrated risk)
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STRESS TEST TAB ───────────────────────────────────────────────── */}
      {tab === 'stress' && (
        <React.Fragment>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi accent">
              <div className="lab">Current Portfolio</div>
              <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(currentValue)}</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>Before stress</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h"><div className="t">Stress Scenarios</div><div className="s">Simulated impact on current portfolio value</div></div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th className="num">Market Drop</th>
                    <th className="num">Portfolio After</th>
                    <th className="num">Loss Amount</th>
                    <th style={{ width: 200 }}>Impact bar</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIOS.map(sc => {
                    const after = currentValue * (1 + sc.pct / 100);
                    const loss  = after - currentValue;
                    const pctAbs = Math.abs(sc.pct);
                    return (
                      <tr key={sc.label} className="pos">
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{sc.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{sc.desc}</div>
                        </td>
                        <td className="num down" style={{ fontWeight: 700 }}>{sc.pct}%</td>
                        <td className="num" style={{ fontWeight: 600 }}>{sym}{window.fmtBig(Math.max(0, after))}</td>
                        <td className="num down">{sym}{window.fmtBig(Math.abs(loss))}</td>
                        <td>
                          <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: Math.min(100, pctAbs * 1.25) + '%',
                              background: pctAbs < 20 ? '#f59e0b' : pctAbs < 50 ? 'var(--red-600)' : '#7f1d1d',
                              borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">Custom scenario</div></div>
            <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>Market change:</label>
                <input type="number" min="-100" max="500" step="1" value={customPct} onChange={e => setCustomPct(e.target.value)}
                       style={{ width: 80, textAlign: 'right' }} />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
              {(() => {
                const p = parseFloat(customPct);
                if (isNaN(p)) return null;
                const after = currentValue * (1 + p / 100);
                const diff  = after - currentValue;
                return (
                  <div style={{ fontSize: 14, fontWeight: 600, color: diff >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>
                    Portfolio: {sym}{window.fmtBig(Math.max(0, after))}
                    <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8, color: 'var(--fg-3)' }}>
                      ({diff >= 0 ? '+' : ''}{sym}{window.fmtBig(diff)})
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ── YIELD ON COST TAB ─────────────────────────────────────────────── */}
      {tab === 'yoc' && (
        <React.Fragment>
          {yocRows.filter(r => r.totalDivIncome > 0).length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No dividend data</div>
              <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>
                Add dividend entries in the Dividend Calendar to see yield on cost calculations.
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-h">
                <div className="t">Yield on Cost</div>
                <div className="s">Annual dividend income ÷ cost basis · shows return on original investment</div>
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="ptable">
                  <thead>
                    <tr>
                      <th>Holding</th>
                      <th className="num">Cost Basis</th>
                      <th className="num">Current Value</th>
                      <th className="num">Div Income</th>
                      <th className="num">Yield on Cost</th>
                      <th className="num">Current Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yocRows.map(r => (
                      <tr key={r.cls.key + ':' + r.name} className="pos">
                        <td>
                          <span className="tk">
                            <span className="av" style={{ background: window.CLASS_COLORS[r.cls.key], borderRadius: 7 }}>{r.cls.short.slice(0, 2)}</span>
                            <span style={{ fontWeight: 600 }}>{r.name.replace(/THB$/, '')}</span>
                          </span>
                        </td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(r.cost)}</td>
                        <td className="num">{sym}{window.fmtBig(r.value)}</td>
                        <td className="num up">{r.totalDivIncome > 0 ? sym + window.fmtBig(r.totalDivIncome) : '—'}</td>
                        <td className="num" style={{ fontWeight: 700, color: r.yoc > 5 ? 'var(--green-600)' : r.yoc > 2 ? '#f59e0b' : 'var(--fg-2)' }}>
                          {r.yoc > 0 ? r.yoc.toFixed(2) + '%' : '—'}
                        </td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>
                          {r.curYield > 0 ? r.curYield.toFixed(2) + '%' : '—'}
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
    </div>
  );
}
