/* eslint-disable */
/* SellLog.jsx — record realized sales, view profit/loss history */

function SellLogView() {
  useStore();
  const settings  = Store.settings();
  const disp      = settings.displayCcy;
  const sym       = window.ccySymbol(disp);

  // ── Form state ────────────────────────────────────────────────────────────
  const [classKey,   setClassKey]   = React.useState(window.ASSET_CLASSES[0].key);
  const [name,       setName]       = React.useState('');
  const [buyPrice,   setBuyPrice]   = React.useState('');
  const [sellPrice,  setSellPrice]  = React.useState('');
  const [qty,        setQty]        = React.useState('');
  const [date,       setDate]       = React.useState(new Date().toISOString().slice(0, 10));
  const [saved,      setSaved]      = React.useState(false);

  // Wallet credit state
  const [creditOn,      setCreditOn]      = React.useState(false);
  const [walletAccId,   setWalletAccId]   = React.useState('');
  const [walletFxRate,  setWalletFxRate]  = React.useState('');

  const cls         = Store.classByKey(classKey);
  const posInClass  = Store.positions(classKey);
  const selectedPos = posInClass.find(p => p.name === name);
  const availableQty = selectedPos ? selectedPos.qty : 0;
  const avgCost      = selectedPos ? selectedPos.avgPrice : 0;

  React.useEffect(() => {
    setName(''); setBuyPrice(''); setSellPrice(''); setQty('');
  }, [classKey]);

  React.useEffect(() => {
    if (selectedPos) setBuyPrice(String(+avgCost.toFixed(6)));
  }, [name, classKey]);

  const buyN     = parseFloat(buyPrice)  || 0;
  const sellN    = parseFloat(sellPrice) || 0;
  const qtyN     = parseFloat(qty)       || 0;
  const cost     = buyN  * qtyN;
  const proceeds = sellN * qtyN;
  const pnl      = proceeds - cost;
  const pnlPct   = cost ? (pnl / cost) * 100 : 0;
  const valid    = name.trim() && qtyN > 0 && buyN > 0 && sellN > 0;
  const overQty  = availableQty > 0 && qtyN > availableQty;

  // Wallet credit helpers
  const walletAccounts     = (Store.getWallet().accounts || []).filter(a => !a.archived);
  const selectedWalletAcc  = walletAccounts.find(a => a.id === walletAccId);
  const assetCcy           = cls ? cls.ccy : 'THB';
  const crossCcy           = selectedWalletAcc && selectedWalletAcc.currency !== assetCcy;
  const creditFxN          = parseFloat(walletFxRate) ||
    (crossCcy ? Store.defaultFxRate(assetCcy, selectedWalletAcc.currency) : 1);
  const creditAmount       = proceeds * (crossCcy ? creditFxN : 1);
  const creditCcy          = selectedWalletAcc ? selectedWalletAcc.currency : assetCcy;

  const handleSubmit = () => {
    if (!valid) return;
    const walletData = creditOn && walletAccId
      ? { accountId: walletAccId, exchangeRate: crossCcy ? creditFxN : null }
      : null;
    Store.recordSale(classKey, { date, name: name.trim(), ccy: cls.ccy, buyPrice: buyN, sellPrice: sellN, qty: qtyN }, walletData);
    setName(''); setBuyPrice(''); setSellPrice(''); setQty('');
    setDate(new Date().toISOString().slice(0, 10));
    setCreditOn(false); setWalletAccId(''); setWalletFxRate('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  // ── Summary data ──────────────────────────────────────────────────────────
  const sales       = Store.getSales();
  const summary     = Store.salesSummary();
  const currentYear = new Date().getFullYear().toString();
  const thisYear    = summary.find(s => s.year === currentYear) || { year: currentYear, cost: 0, proceeds: 0, pnl: 0, pnlPct: 0, count: 0 };
  const allTimePnl  = summary.reduce((a, s) => a + s.pnl,  0);
  const allTimeCost = summary.reduce((a, s) => a + s.cost, 0);
  const allTimePct  = allTimeCost ? (allTimePnl / allTimeCost) * 100 : 0;

  // ── History filters ───────────────────────────────────────────────────────
  const [filterYear, setFilterYear] = React.useState('all');
  const years    = [...new Set(sales.map(s => s.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const filtered = sales
    .filter(s => filterYear === 'all' || s.date.slice(0, 4) === filterYear)
    .sort((a, b) => b.date.localeCompare(a.date));

  // salesSummary stores values in THB; convert to display currency.
  const cvt = v => Store.toDisplay(v, 'THB');

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Sell Log</h1>
        <div className="t-small">Record realized sales and track your profit/loss history.</div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ marginBottom: 22 }}>
        <div className="kpi accent">
          <div className="lab">{currentYear} Realized P/L</div>
          <div className={'big ' + (thisYear.pnl >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>
            {(thisYear.pnl >= 0 ? '+' : '−') + window.fmtBig(Math.abs(cvt(thisYear.pnl)))}
          </div>
          <div className={'delta ' + (thisYear.pnlPct >= 0 ? 'up' : 'down')}>{window.fmtPct(thisYear.pnlPct)}</div>
        </div>
        <div className="kpi">
          <div className="lab">All-time Realized P/L</div>
          <div className={'big ' + (allTimePnl >= 0 ? 'up' : 'down')}>
            <span className="ccy">{sym}</span>
            {(allTimePnl >= 0 ? '+' : '−') + window.fmtBig(Math.abs(cvt(allTimePnl)))}
          </div>
          <div className={'delta ' + (allTimePct >= 0 ? 'up' : 'down')}>{window.fmtPct(allTimePct)}</div>
        </div>
        <div className="kpi">
          <div className="lab">{currentYear} Trades</div>
          <div className="big">{thisYear.count}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>sales this year</div>
        </div>
        <div className="kpi">
          <div className="lab">All-time Trades</div>
          <div className="big">{sales.length}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>total sales logged</div>
        </div>
      </div>

      {/* Form + yearly summary side-by-side */}
      <div className="dash dash-2col" style={{ alignItems: 'start', display: 'block' }}>
        <div className="card">
          <div className="card-h">
            <div className="t">Record a Sale</div>
            <div className="s">Fill in sale details — buy price auto-fills from avg cost</div>
          </div>
          <div className="card-b">
            <div className="mgrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <div style={{ minWidth: 0 }}>
                <label className="flabel">Asset Class</label>
                <select className="input" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={classKey} onChange={e => setClassKey(e.target.value)}>
                  {window.ASSET_CLASSES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label className="flabel">Sale Date</label>
                <input className="input" type="date" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={date} onChange={e => setDate(e.target.value)} />
              </div>

              <div className="full" style={{ minWidth: 0 }}>
                <label className="flabel">Ticker / Asset Name</label>
                <input className="input" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={name} onChange={e => setName(e.target.value)}
                       list="sell-ticker-list"
                       placeholder={posInClass[0] ? 'e.g. ' + posInClass[0].name : 'e.g. AAPL'} />
                <datalist id="sell-ticker-list">
                  {posInClass.map(p => <option key={p.name} value={p.name} />)}
                </datalist>
                {selectedPos && (
                  <div className="t-small" style={{ marginTop: 5, color: 'var(--fg-3)' }}>
                    Holding: <strong>{window.fmtQty(availableQty)}</strong> units &nbsp;·&nbsp; Avg cost: <strong>{window.fmtMoney(avgCost, cls.ccy, 4)}</strong>
                  </div>
                )}
                {name.trim() && !selectedPos && (
                  <div className="t-small" style={{ marginTop: 5, color: 'var(--fg-3)' }}>
                    Not in holdings — enter cost &amp; sell price below to calculate P/L.
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <label className="flabel">Buy Price ({cls?.ccy})</label>
                <input className="input" type="number" step="any" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={buyPrice}
                       onChange={e => setBuyPrice(e.target.value)} placeholder="Cost per unit" />
              </div>
              <div style={{ minWidth: 0 }}>
                <label className="flabel">Sell Price ({cls?.ccy})</label>
                <input className="input" type="number" step="any" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={sellPrice}
                       onChange={e => setSellPrice(e.target.value)} placeholder="Sale price per unit" />
              </div>

              <div className="full" style={{ minWidth: 0 }}>
                <label className="flabel">Quantity / Units Sold</label>
                <input className="input" type="number" step="any" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={qty}
                       onChange={e => setQty(e.target.value)} placeholder="Number of units sold" />
                {selectedPos && availableQty > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {[25, 50, 75, 100].map(pct => (
                      <button key={pct} className="icon-toggle"
                              style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: '3px 0', borderRadius: 6,
                                       background: 'var(--bg-inset,var(--bg-app))', border: '1px solid var(--border-1)' }}
                              onClick={() => setQty(String(+(availableQty * pct / 100).toFixed(6)))}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
                {overQty && (
                  <div className="t-small" style={{ marginTop: 5, color: '#f59e0b' }}>
                    Warning: exceeds current holding of {window.fmtQty(availableQty)} units.
                  </div>
                )}
              </div>

              {valid && (
                <div className="full computed">
                  <div className="c"><small>Cost Basis</small>{window.fmtMoney(cost, cls.ccy, 2)}</div>
                  <div className="c"><small>Proceeds</small>{window.fmtMoney(proceeds, cls.ccy, 2)}</div>
                  <div className="c"><small>Realized P/L</small>
                    <span className={pnl >= 0 ? 'up' : 'down'}>
                      {(pnl >= 0 ? '+' : '−') + window.fmtMoney(Math.abs(pnl), cls.ccy, 2)}
                    </span>
                  </div>
                  <div className="c"><small>Return</small>
                    <span className={pnlPct >= 0 ? 'up' : 'down'}>{window.fmtPct(pnlPct)}</span>
                  </div>
                </div>
              )}

              {/* Wallet credit section */}
              <div className="full" style={{ borderTop: '1px solid var(--border-1)', paddingTop: 14, marginTop: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={creditOn} onChange={e => setCreditOn(e.target.checked)}
                         style={{ width: 14, height: 14, cursor: 'pointer' }} />
                  <span style={{ fontWeight: 600, fontSize: 12 }}>Add sale proceeds to wallet account</span>
                </label>

                {creditOn && (
                  <div className="mgrid" style={{ marginTop: 10 }}>
                    <div>
                      <label className="flabel">Wallet Account</label>
                      <select className="input" value={walletAccId} onChange={e => { setWalletAccId(e.target.value); setWalletFxRate(''); }}>
                        <option value="">Select account…</option>
                        {walletAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                        ))}
                      </select>
                      {walletAccounts.length === 0 && (
                        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>No wallet accounts yet. Add one in the Wallet section first.</div>
                      )}
                    </div>

                    {crossCcy && (
                      <div>
                        <label className="flabel">Exchange Rate (1 {assetCcy} = ? {creditCcy})</label>
                        <input className="input" type="number" step="any" min="0"
                               value={walletFxRate}
                               placeholder={creditFxN.toFixed(4)}
                               onChange={e => setWalletFxRate(e.target.value)} />
                        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>Default from live rates. Override if the actual settlement rate differed.</div>
                      </div>
                    )}

                    {selectedWalletAcc && proceeds > 0 && (
                      <div className="full">
                        <div style={{ background: 'var(--bg-inset,var(--bg-app))', borderRadius: 6, padding: '8px 12px',
                                      fontSize: 12, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--green-600)' }}>+</span>
                          <strong style={{ color: 'var(--green-600)' }}>{window.fmtCcy(creditAmount, creditCcy)}</strong>
                          <span style={{ color: 'var(--fg-3)' }}>
                            will be added to <strong>{selectedWalletAcc.name}</strong>
                            {crossCcy && ` (at ${creditFxN.toFixed(4)} ${assetCcy}/${creditCcy})`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="full" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                {saved && <span style={{ color: 'var(--green-600)', fontWeight: 600, fontSize: 13 }}>✓ Sale recorded</span>}
                <Button variant="accent" icon="trending-down" onClick={handleSubmit} disabled={!valid}>Record Sale</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Yearly P/L summary */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-h">
            <div className="t">Yearly P/L Summary</div>
            <div className="s">Realized profit/loss aggregated by year</div>
          </div>
          {summary.length === 0 ? (
            <div className="empty" style={{ padding: '40px 20px' }}>No sales recorded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable">
                <thead><tr>
                  <th>Year</th>
                  <th className="num">Trades</th>
                  <th className="num">Cost Basis</th>
                  <th className="num">Proceeds</th>
                  <th className="num">P/L</th>
                  <th className="num">Return</th>
                </tr></thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.year}>
                      <td>
                        <strong>{s.year}</strong>
                        {s.year === currentYear && <span className="sectorchip" style={{ marginLeft: 7 }}>This year</span>}
                      </td>
                      <td className="num">{s.count}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(cvt(s.cost))}</td>
                      <td className="num">{sym}{window.fmtBig(cvt(s.proceeds))}</td>
                      <td className={'num ' + (s.pnl >= 0 ? 'up' : 'down')}>
                        {(s.pnl >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(cvt(s.pnl)))}
                      </td>
                      <td className={'num ' + (s.pnlPct >= 0 ? 'up' : 'down')}>{window.fmtPct(s.pnlPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sale history table */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-h">
          <div>
            <div className="t">Sale History</div>
            <div className="s">{filtered.length} record{filtered.length !== 1 ? 's' : ''} shown</div>
          </div>
          <div className="layoutseg">
            <button className={filterYear === 'all' ? 'on' : ''} onClick={() => setFilterYear('all')}>All</button>
            {years.map(y => (
              <button key={y} className={filterYear === y ? 'on' : ''} onClick={() => setFilterYear(y)}>{y}</button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty" style={{ padding: '40px 20px' }}>
            {sales.length === 0 ? 'No sales recorded yet. Use the form above to log your first sale.' : 'No sales for this filter.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable" style={{ minWidth: 860 }}>
              <thead><tr>
                <th>Date</th>
                <th>Class</th>
                <th>Ticker</th>
                <th className="num">Qty</th>
                <th className="num">Buy Price</th>
                <th className="num">Sell Price</th>
                <th className="num">Cost Basis</th>
                <th className="num">Proceeds</th>
                <th className="num">P/L</th>
                <th className="num">Return</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.map(s => {
                  const saleCls    = Store.classByKey(s.classKey);
                  const dispPnl      = Store.toDisplay(s.realizedPnl, s.ccy);
                  const dispProceeds = Store.toDisplay(s.proceeds, s.ccy);
                  const dispCost     = Store.toDisplay(s.cost, s.ccy);
                  return (
                    <tr key={s.id} className="pos">
                      <td style={{ color: 'var(--fg-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{s.date}</td>
                      <td>
                        <span className="tk">
                          <span className="av" style={{ background: window.CLASS_COLORS[s.classKey], borderRadius: 7 }}>
                            {(saleCls?.label || s.classKey).slice(0, 2).toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{saleCls?.label || s.classKey}</span>
                        </span>
                      </td>
                      <td><span style={{ font: '600 13px/1 var(--font-sans)' }}>{s.name.replace(/THB$/, '')}</span></td>
                      <td className="num">{window.fmtQty(s.qty)}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{window.fmtMoney(s.buyPrice, s.ccy, 4)}</td>
                      <td className="num">{window.fmtMoney(s.sellPrice, s.ccy, 4)}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(dispCost)}</td>
                      <td className="num">{sym}{window.fmtBig(dispProceeds)}</td>
                      <td className={'num ' + (s.realizedPnl >= 0 ? 'up' : 'down')}>
                        {(s.realizedPnl >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(dispPnl))}
                      </td>
                      <td className={'num ' + (s.pnlPct >= 0 ? 'up' : 'down')}>{window.fmtPct(s.pnlPct)}</td>
                      <td>
                        <button className="icon-toggle" style={{ color: 'var(--red-600)', opacity: 0.7 }}
                                title="Delete this sale record"
                                onClick={() => { if (window.confirm('Delete this sale record?')) Store.deleteSale(s.id); }}>
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
