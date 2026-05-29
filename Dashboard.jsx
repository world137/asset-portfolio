/* eslint-disable */
/* Dashboard.jsx — KPIs, allocation chart, per-class summary. 3 layouts. */

function PortfolioHistoryCard({ settings }) {
  const snapshots = Store.getSnapshots();
  const fxRate = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="card-h">
        <div>
          <div className="t">Portfolio History</div>
          <div className="s">Daily snapshots · valued in {settings.displayCcy} · snapshotted on price refresh</div>
        </div>
      </div>
      <div className="card-b">
        <PortfolioLineChart snapshots={snapshots} displayCcy={settings.displayCcy} fxRate={fxRate} />
      </div>
    </div>
  );
}

function AllocChart({ totals, settings, hot, setHot, onOpenClass, size }) {
  const segs = totals.classes.map(c => ({ key: c.key, label: c.label, value: c.value, color: c.color }));
  const disp = settings.displayCcy;
  return (
    <div className="chartwrap">
      <Donut
        segments={segs} size={size || 196} style={settings.chartStyle} hot={hot} onHover={setHot}
        center={
          <React.Fragment>
            <div className="c-lab">Total Value</div>
            <div className="c-val">{window.ccySymbol(disp)}{window.fmtBig(totals.value)}</div>
            <div className={'c-sub ' + (totals.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(totals.pct)}</div>
          </React.Fragment>
        }
      />
      <div className="legend">
        {segs.map((s, i) => {
          const pc = totals.value ? (s.value / totals.value) * 100 : 0;
          return (
            <div className="row" key={s.key}
                 onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                 onClick={() => onOpenClass(s.key)}>
              <span className="sw" style={{ background: s.color }} />
              <span className="nm">{s.label}</span>
              <span className="vv">{window.ccySymbol(disp)}{window.fmtBig(s.value)}</span>
              <span className="pc">{pc.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiRow({ totals, settings }) {
  const disp = settings.displayCcy;
  const sym = window.ccySymbol(disp);
  return (
    <div className="kpis">
      <div className="kpi accent">
        <div className="lab">Portfolio Value</div>
        <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totals.value)}</div>
        <div className={'delta ' + (totals.profit >= 0 ? 'up' : 'down')}>
          <Icon name={totals.profit >= 0 ? 'success' : 'warning'} size={13} />
          {window.fmtPct(totals.pct)} all-time
        </div>
      </div>
      <div className="kpi">
        <div className="lab">Total Cost</div>
        <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totals.cost)}</div>
        <div className="delta" style={{ color: 'var(--fg-3)' }}>{totals.classes.length} asset classes</div>
      </div>
      <div className="kpi">
        <div className="lab">Unrealized P/L</div>
        <div className={'big ' + (totals.profit >= 0 ? 'up' : 'down')}>
          <span className="ccy">{sym}</span>{(totals.profit >= 0 ? '+' : '−') + window.fmtBig(Math.abs(totals.profit))}
        </div>
        <div className={'delta ' + (totals.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(totals.pct)}</div>
      </div>
      <div className="kpi">
        <div className="lab">Holdings</div>
        <div className="big">{totals.classes.reduce((a, c) => a + c.count, 0)}</div>
        <div className="delta" style={{ color: 'var(--fg-3)' }}>positions tracked</div>
      </div>
    </div>
  );
}

function ClassTable({ totals, settings, onOpenClass, hot, setHot }) {
  const disp = settings.displayCcy;
  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>Asset Class</th>
          <th style={{ width: 150 }}>Allocation</th>
          <th className="num">Value</th>
          <th className="num">Cost</th>
          <th className="num">P/L</th>
          <th className="num">%</th>
        </tr>
      </thead>
      <tbody>
        {totals.classes.map((c, i) => {
          const pc = totals.value ? (c.value / totals.value) * 100 : 0;
          return (
            <tr className="pos" key={c.key} onClick={() => onOpenClass(c.key)}
                onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
              <td>
                <span className="tk"><span className="av" style={{ background: c.color, borderRadius: 7 }}>{c.label.slice(0, 2).toUpperCase()}</span>{c.label}</span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="minibar" style={{ flex: 1 }}><span style={{ width: pc + '%', background: c.color }} /></div>
                  <span style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--fg-3)', minWidth: 38, textAlign: 'right' }}>{pc.toFixed(1)}%</span>
                </div>
              </td>
              <td className="num">{window.ccySymbol(disp)}{window.fmtBig(c.value)}</td>
              <td className="num" style={{ color: 'var(--fg-3)' }}>{window.ccySymbol(disp)}{window.fmtBig(c.cost)}</td>
              <td className={'num ' + (c.profit >= 0 ? 'up' : 'down')}>{(c.profit >= 0 ? '+' : '−') + window.ccySymbol(disp) + window.fmtBig(Math.abs(c.profit))}</td>
              <td className={'num ' + (c.profit >= 0 ? 'up' : 'down')}>{window.fmtPct(c.pct)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Dashboard({ onOpenClass }) {
  const settings = Store.settings();
  const totals = Store.grandTotals();
  const [hot, setHot] = React.useState(null);
  const layout = settings.layout;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Portfolio Overview</h1>
          <div className="t-small">All holdings, valued in {settings.displayCcy}. Click any class to manage holdings.</div>
        </div>
        <div className="layoutseg">
          {[['overview', 'Overview'], ['compact', 'Compact'], ['visual', 'Visual']].map(([v, l]) => (
            <button key={v} className={layout === v ? 'on' : ''} onClick={() => Store.setSetting('layout', v)}>{l}</button>
          ))}
        </div>
      </div>

      <KpiRow totals={totals} settings={settings} />

      {layout === 'overview' && (
        <div className="dash dash-2col">
          <div className="card">
            <div className="card-h"><div><div className="t">Asset Allocation</div></div></div>
            <div className="card-b"><AllocChart totals={totals} settings={settings} hot={hot} setHot={setHot} onOpenClass={onOpenClass} /></div>
          </div>
          <div className="card">
            <div className="card-h"><div><div className="t">By Asset Class</div></div></div>
            <ClassTable totals={totals} settings={settings} onOpenClass={onOpenClass} hot={hot} setHot={setHot} />
          </div>
        </div>
      )}

      {layout === 'compact' && (
        <div className="card">
          <div className="card-h">
            <div><div className="t">Allocation & Performance</div><div className="s">{totals.classes.length} classes · valued in {settings.displayCcy}</div></div>
            <Donut segments={totals.classes.map(c => ({ value: c.value, color: c.color }))} size={64} style={settings.chartStyle} hot={hot} onHover={setHot} />
          </div>
          <ClassTable totals={totals} settings={settings} onOpenClass={onOpenClass} hot={hot} setHot={setHot} />
        </div>
      )}

      {layout === 'visual' && (
        <div className="dash dash-visual">
          <div className="card">
            <div className="card-b" style={{ display: 'flex', justifyContent: 'center', padding: '28px 18px 24px' }}>
              <AllocChart totals={totals} settings={settings} hot={hot} setHot={setHot} onOpenClass={onOpenClass} size={240} />
            </div>
          </div>
          <div className="classgrid">
            {totals.classes.map(c => {
              const pc = totals.value ? (c.value / totals.value) * 100 : 0;
              return (
                <div className="classcard" key={c.key} onClick={() => onOpenClass(c.key)}>
                  <div className="top"><span className="d" style={{ background: c.color }} /><span className="nm">{c.label}</span><span className="ct">{c.count}</span></div>
                  <div className="v">{window.ccySymbol(settings.displayCcy)}{window.fmtBig(c.value)}</div>
                  <div className="meta">
                    <span style={{ color: 'var(--fg-3)' }}>{pc.toFixed(1)}% of port</span>
                    <span className={c.profit >= 0 ? 'up' : 'down'}>{window.fmtPct(c.pct)}</span>
                  </div>
                  <div className="minibar" style={{ marginTop: 12 }}><span style={{ width: pc + '%', background: c.color }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PortfolioHistoryCard settings={settings} />
    </div>
  );
}

window.Dashboard = Dashboard;
window.AllocChart = AllocChart;
