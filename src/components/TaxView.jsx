/* eslint-disable */
/* TaxView.jsx — Feature #4: Thai Tax Summary for capital gains & dividend income */

function TaxView() {
  const store    = useStore();
  const sales    = Store.getSales();
  const dividends = Store.getDividends();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const USDTHB   = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;

  const curYear = new Date().getFullYear();
  const years   = [...new Set([
    ...sales.map(s => s.date.slice(0, 4)),
    ...dividends.map(d => (d.payDate || '').slice(0, 4)),
    String(curYear),
  ])].filter(Boolean).sort((a, b) => b.localeCompare(a));

  const [year, setYear] = React.useState(String(curYear));

  function toTHB(amount, ccy) {
    return ccy === 'USD' ? amount * USDTHB : amount;
  }
  function toDisp(amount, ccy) {
    return Store.toDisplay(toTHB(amount, ccy), 'THB');
  }

  // Capital gains for the selected year
  const yearSales = sales.filter(s => s.date.startsWith(year));
  const gainSales = yearSales.filter(s => s.realizedPnl >= 0);
  const lossSales = yearSales.filter(s => s.realizedPnl < 0);
  const totalGain = gainSales.reduce((a, s) => a + toDisp(s.realizedPnl, s.ccy), 0);
  const totalLoss = lossSales.reduce((a, s) => a + toDisp(Math.abs(s.realizedPnl), s.ccy), 0);
  const netGain   = totalGain - totalLoss;

  // Dividend income for the selected year
  const yearDivs = dividends.filter(d => (d.payDate || '').startsWith(year));
  function divDisp(d) {
    const raw = d.totalAmount || 0;
    return toDisp(raw, d.currency);
  }
  const totalDivs = yearDivs.reduce((a, d) => a + divDisp(d), 0);

  // Thai withholding tax estimates
  // Domestic dividends: 10% WHT
  // Foreign/crypto capital gains: 15% (simplified)
  const estimatedWHT   = totalDivs * 0.10;
  const estimatedCGTax = Math.max(0, netGain) * 0.15;

  // Group sales by class
  const salesByClass = new Map();
  for (const s of yearSales) {
    if (!salesByClass.has(s.classKey)) salesByClass.set(s.classKey, []);
    salesByClass.get(s.classKey).push(s);
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Tax Summary</h1>
          <div className="t-small">Realized capital gains & dividend income · estimates only, consult a Thai tax advisor</div>
        </div>
        <div className="layoutseg">
          {years.map(y => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      </div>

      <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--fg-2)' }}>
        ⚠️ <strong>Disclaimer:</strong> These figures are for reference only. Thai tax rules vary by income type, residency status, and DTA treaties. Consult a certified Thai tax advisor (นักบัญชีภาษี) for accurate obligations.
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi accent">
          <div className="lab">Net Capital Gain {year}</div>
          <div className={'big ' + (netGain >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>{(netGain >= 0 ? '' : '−') + window.fmtBig(Math.abs(netGain))}
          </div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{yearSales.length} trades</div>
        </div>
        <div className="kpi">
          <div className="lab">Dividend Income {year}</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(totalDivs)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{yearDivs.length} entries</div>
        </div>
        <div className="kpi">
          <div className="lab">Est. WHT on Dividends</div>
          <div className="big" style={{ color: 'var(--red-600)' }}><span className="ccy">{sym}</span>{window.fmtBig(estimatedWHT)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>10% flat rate</div>
        </div>
        <div className="kpi">
          <div className="lab">Est. CGT (if applicable)</div>
          <div className="big" style={{ color: netGain > 0 ? 'var(--red-600)' : 'var(--fg-3)' }}>
            {netGain > 0 ? <React.Fragment><span className="ccy">{sym}</span>{window.fmtBig(estimatedCGTax)}</React.Fragment> : '—'}
          </div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>15% (foreign assets)</div>
        </div>
      </div>

      {/* Capital Gains Detail */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <div>
            <div className="t">Capital Gains & Losses — {year}</div>
            <div className="s">{yearSales.length} trades · from sell log</div>
          </div>
        </div>

        {yearSales.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--fg-3)', fontSize: 13 }}>No sales recorded in {year}.</div>
        ) : (
          <React.Fragment>
            {/* Summary row */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-1)' }}>
              {[
                { label: 'Total Gains', value: totalGain, color: 'var(--green-600)' },
                { label: 'Total Losses', value: -totalLoss, color: 'var(--red-600)' },
                { label: 'Net', value: netGain, color: netGain >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
              ].map(item => (
                <div key={item.label} style={{ flex: 1, padding: '12px 18px', borderRight: '1px solid var(--border-1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: item.color }}>
                    {item.value >= 0 ? '+' : ''}{sym}{window.fmtBig(Math.abs(item.value))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Class</th>
                    <th>Ticker</th>
                    <th className="num">Qty</th>
                    <th className="num">Buy Price</th>
                    <th className="num">Sell Price</th>
                    <th className="num">Cost</th>
                    <th className="num">Proceeds</th>
                    <th className="num">P/L</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...yearSales].sort((a, b) => b.date.localeCompare(a.date)).map(s => {
                    const pnlDisp  = toDisp(s.realizedPnl, s.ccy);
                    const costDisp = toDisp(s.cost, s.ccy);
                    const procDisp = toDisp(s.proceeds, s.ccy);
                    const cls      = window.ASSET_CLASSES.find(c => c.key === s.classKey);
                    return (
                      <tr key={s.id} className="pos">
                        <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{s.date}</td>
                        <td>
                          <span className="av" style={{ background: cls ? window.CLASS_COLORS[cls.key] : '#888', borderRadius: 7, fontSize: 9 }}>
                            {(cls ? cls.short : '?').slice(0, 3)}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{s.name.replace(/THB$/, '')}</td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{window.fmtQty(s.qty)}</td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{window.fmtPrice(s.buyPrice, s.ccy)}</td>
                        <td className="num">{window.fmtPrice(s.sellPrice, s.ccy)}</td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(costDisp)}</td>
                        <td className="num">{sym}{window.fmtBig(procDisp)}</td>
                        <td className={'num ' + (pnlDisp >= 0 ? 'up' : 'down')} style={{ fontWeight: 700 }}>
                          {(pnlDisp >= 0 ? '+' : '−')}{sym}{window.fmtBig(Math.abs(pnlDisp))}
                        </td>
                        <td className={'num ' + (s.pnlPct >= 0 ? 'up' : 'down')} style={{ fontSize: 12 }}>
                          {s.pnlPct >= 0 ? '+' : ''}{s.pnlPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </React.Fragment>
        )}
      </div>

      {/* Dividend income table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <div>
            <div className="t">Dividend Income — {year}</div>
            <div className="s">{yearDivs.length} entries · from dividend calendar</div>
          </div>
        </div>

        {yearDivs.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--fg-3)', fontSize: 13 }}>
            No dividend income logged for {year}. Add entries in the Dividend Calendar.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="ptable">
              <thead>
                <tr>
                  <th>Pay Date</th>
                  <th>Holding</th>
                  <th className="num">Gross Income</th>
                  <th className="num">WHT (10%)</th>
                  <th className="num">Net</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...yearDivs].sort((a, b) => (b.payDate || '').localeCompare(a.payDate || '')).map(d => {
                  const gross = divDisp(d);
                  const wht   = gross * 0.10;
                  const cls   = window.ASSET_CLASSES.find(c => c.key === d.classKey);
                  return (
                    <tr key={d.id} className="pos">
                      <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{d.payDate}</td>
                      <td>
                        <span className="tk">
                          <span className="av" style={{ background: cls ? window.CLASS_COLORS[cls.key] : '#888', borderRadius: 7, fontSize: 9 }}>
                            {(cls ? cls.short : '?').slice(0, 3)}
                          </span>
                          <span style={{ fontWeight: 600 }}>{d.name.replace(/THB$/, '')}</span>
                        </span>
                      </td>
                      <td className="num up">{sym}{window.fmtBig(gross)}</td>
                      <td className="num" style={{ color: 'var(--red-600)' }}>−{sym}{window.fmtBig(wht)}</td>
                      <td className="num up" style={{ fontWeight: 700 }}>{sym}{window.fmtBig(gross - wht)}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{d.note || '—'}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--bg-sunken)', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '10px 18px', fontSize: 13 }}>Total</td>
                  <td className="num up">{sym}{window.fmtBig(totalDivs)}</td>
                  <td className="num" style={{ color: 'var(--red-600)' }}>−{sym}{window.fmtBig(estimatedWHT)}</td>
                  <td className="num up">{sym}{window.fmtBig(totalDivs - estimatedWHT)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tax tips */}
      <div className="card">
        <div className="card-h"><div className="t">Thai Tax Reference</div><div className="s">Common rules for individual investors · 2025</div></div>
        <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { icon: '📈', title: 'Thai stock gains (SET)', body: 'Generally exempt for individual investors trading on the SET. Consult RD for OTC trades.' },
            { icon: '🌐', title: 'Foreign asset gains', body: 'Gains from foreign stocks, ETFs, crypto may be taxable as personal income at progressive rates (0-35%).' },
            { icon: '💰', title: 'Dividend WHT', body: 'Thai dividends have 10% withholding tax deducted at source. Can elect to include in personal income for refund if in lower bracket.' },
            { icon: '🪙', title: 'Crypto', body: 'Crypto gains taxable as personal income (Revenue Department, 2022). Report on Por.Ngor.Dor. 90/91.' },
            { icon: '🏦', title: 'Thai mutual funds', body: 'Capital gains from Thai RMF/LTF/SSF may qualify for deductions. Thai fund dividends have 10% WHT.' },
            { icon: '📅', title: 'Filing deadline', body: 'Annual return (Por.Ngor.Dor. 90/91) due March 31 of the following year. E-filing extended to April 8.' },
          ].map(tip => (
            <div key={tip.title} style={{ padding: 12, background: 'var(--bg-sunken)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{tip.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{tip.title}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{tip.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
