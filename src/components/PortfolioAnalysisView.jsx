/* eslint-disable */
/* PortfolioAnalysisView.jsx — Merged analysis hub: Rebalancing, Benchmark, Risk, Goals, Planning */

function PortfolioAnalysisView({ defaultTab }) {
  const [tab, setTab] = React.useState(defaultTab || 'rebalancing');

  const tabs = [
    { key: 'rebalancing', label: 'Rebalancing',  icon: 'sliders'      },
    { key: 'benchmark',   label: 'Benchmark',    icon: 'trending-up'  },
    { key: 'risk',        label: 'Risk',         icon: 'shield'       },
    { key: 'goals',       label: 'Goals',        icon: 'star'         },
    { key: 'planning',    label: 'Planning',     icon: 'calendar'     },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Portfolio Analysis</h1>
        <div className="t-small">Rebalancing · Benchmark · Risk · Goals · Planning</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'background 0.15s, color 0.15s',
              background: tab === t.key ? 'var(--accent, #2962ab)' : 'var(--bg-sunken)',
              color: tab === t.key ? '#fff' : 'var(--fg-2)',
            }}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — inner views have their own .page wrapper which is reset via .page .page CSS */}
      {tab === 'rebalancing' && <RebalancingInner />}
      {tab === 'benchmark'   && <BenchmarkView />}
      {tab === 'risk'        && <RiskView />}
      {tab === 'goals'       && <GoalsView />}
      {tab === 'planning'    && <PlanningView />}
    </div>
  );
}

// ── Rebalancing without its own <div className="page"> wrapper ────────────────
// We re-use the existing RebalancingView logic but strip the outer page div so
// it embeds cleanly inside PortfolioAnalysisView.

function RebalancingInner() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const totals   = Store.grandTotals();
  const totalValue = totals.value || 0;

  const targetAlloc = Store.getTargetAllocation();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft]     = React.useState({});

  React.useEffect(() => {
    const init = {};
    for (const cls of window.ASSET_CLASSES) {
      init[cls.key] = targetAlloc[cls.key] != null ? String(targetAlloc[cls.key]) : '0';
    }
    setDraft(init);
  }, [editing]);

  const rows = window.ASSET_CLASSES.map(cls => {
    const ct       = Store.classTotals(cls.key);
    const curValue = ct.value;
    const curPct   = totalValue > 0 ? (curValue / totalValue) * 100 : 0;
    const tgtPct   = targetAlloc[cls.key] || 0;
    const drift    = curPct - tgtPct;
    const tgtValue = totalValue * (tgtPct / 100);
    const delta    = tgtValue - curValue;
    return { cls, curValue, curPct, tgtPct, drift, delta, color: window.CLASS_COLORS[cls.key] };
  });

  const totalTarget  = rows.reduce((a, r) => a + r.tgtPct, 0);
  const unallocated  = 100 - totalTarget;

  function saveTargets() {
    for (const cls of window.ASSET_CLASSES) {
      const v = parseFloat(draft[cls.key]) || 0;
      Store.setTargetAllocation(cls.key, v);
    }
    setEditing(false);
  }

  const draftTotal = Object.values(draft).reduce((a, v) => a + (parseFloat(v) || 0), 0);
  const hasTgt = rows.some(r => r.tgtPct > 0);

  return (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="t-h2" style={{ margin: 0 }}>Rebalancing</div>
          <div className="t-small">Set target allocation per asset class · see drift · calculate buy/sell amounts</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editing ? (
            <React.Fragment>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={saveTargets} disabled={Math.abs(draftTotal - 100) > 0.01 && draftTotal !== 0}>Save targets</Button>
            </React.Fragment>
          ) : (
            <Button size="sm" icon="edit-2" onClick={() => setEditing(true)}>Edit targets</Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 18px' }}>
          <div className="card-h" style={{ marginBottom: 12 }}>
            <div className="t">Set target allocations</div>
            <div className="s">Must sum to 100% · currently {draftTotal.toFixed(1)}%
              {Math.abs(draftTotal - 100) > 0.01 && draftTotal > 0 &&
                <span style={{ color: 'var(--red-600)', marginLeft: 8 }}>⚠ {(100 - draftTotal).toFixed(1)}% remaining</span>
              }
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {window.ASSET_CLASSES.map(cls => (
              <div key={cls.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: window.CLASS_COLORS[cls.key], flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1, color: 'var(--fg-2)' }}>{cls.label}</span>
                <div style={{ position: 'relative', width: 80 }}>
                  <input type="number" min="0" max="100" step="0.5"
                    value={draft[cls.key] || ''}
                    onChange={e => setDraft(d => ({ ...d, [cls.key]: e.target.value }))}
                    style={{ width: '100%', paddingRight: 20, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }} />
                  <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--fg-3)', pointerEvents: 'none' }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasTgt && !editing && (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No targets set yet</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 16 }}>
            Set target % per asset class to see drift and rebalancing suggestions.
          </div>
          <Button size="sm" onClick={() => setEditing(true)}>Set targets</Button>
        </div>
      )}

      {hasTgt && (
        <React.Fragment>
          <div className="kpis" style={{ marginBottom: 18 }}>
            <div className="kpi accent">
              <div className="lab">Portfolio Value</div>
              <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totalValue)}</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>{totals.classes.length} asset classes</div>
            </div>
            <div className="kpi">
              <div className="lab">Target Allocated</div>
              <div className="big">{totalTarget.toFixed(1)}%</div>
              {Math.abs(unallocated) > 0.1 &&
                <div className="delta" style={{ color: unallocated > 0 ? 'var(--fg-3)' : 'var(--red-600)' }}>
                  {unallocated > 0 ? `${unallocated.toFixed(1)}% unallocated` : `${Math.abs(unallocated).toFixed(1)}% over 100%`}
                </div>
              }
            </div>
            <div className="kpi">
              <div className="lab">Overweight</div>
              <div className="big" style={{ color: 'var(--red-600)' }}>{rows.filter(r => r.tgtPct > 0 && r.drift > 2).length}</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>drift &gt; 2%</div>
            </div>
            <div className="kpi">
              <div className="lab">Underweight</div>
              <div className="big" style={{ color: 'var(--green-600)' }}>{rows.filter(r => r.tgtPct > 0 && r.drift < -2).length}</div>
              <div className="delta" style={{ color: 'var(--fg-3)' }}>drift &lt; -2%</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h"><div className="t">Current vs Target Allocation</div></div>
            <div className="card-b" style={{ padding: '8px 18px 16px' }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>CURRENT</div>
                <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-sunken)' }}>
                  {rows.filter(r => r.curValue > 0).map(r => (
                    <div key={r.cls.key} title={`${r.cls.label}: ${r.curPct.toFixed(1)}%`}
                         style={{ width: r.curPct + '%', background: r.color, transition: 'width 0.3s' }} />
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>TARGET</div>
                <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-sunken)' }}>
                  {rows.filter(r => r.tgtPct > 0).map(r => (
                    <div key={r.cls.key} title={`${r.cls.label}: ${r.tgtPct.toFixed(1)}%`}
                         style={{ width: r.tgtPct + '%', background: r.color, opacity: 0.7, transition: 'width 0.3s' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                {rows.filter(r => r.curValue > 0 || r.tgtPct > 0).map(r => (
                  <div key={r.cls.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--fg-2)' }}>{r.cls.short}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Rebalancing Actions</div>
              <div className="s">Buy/sell to reach target · in {settings.displayCcy}</div>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Asset Class</th>
                    <th className="num">Current Value</th>
                    <th className="num">Current %</th>
                    <th className="num">Target %</th>
                    <th className="num" style={{ width: 160 }}>Drift</th>
                    <th className="num">Target Value</th>
                    <th className="num">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter(r => r.curValue > 0 || r.tgtPct > 0).map(r => {
                    const driftAbs = Math.abs(r.drift);
                    const driftColor = driftAbs < 1 ? 'var(--fg-3)' : driftAbs < 3 ? 'var(--fg-2)' : r.drift > 0 ? 'var(--red-600)' : 'var(--green-600)';
                    const tgtValue = totalValue * (r.tgtPct / 100);
                    return (
                      <tr key={r.cls.key} className="pos">
                        <td>
                          <span className="tk">
                            <span className="av" style={{ background: r.color, borderRadius: 7 }}>{r.cls.short}</span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{r.cls.label}</span>
                          </span>
                        </td>
                        <td className="num">{sym}{window.fmtBig(r.curValue)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{r.curPct.toFixed(1)}%</td>
                        <td className="num" style={{ color: r.tgtPct > 0 ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                          {r.tgtPct > 0 ? r.tgtPct.toFixed(1) + '%' : '—'}
                        </td>
                        <td>
                          {r.tgtPct > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-sunken)', overflow: 'hidden', minWidth: 60 }}>
                                <div style={{ width: Math.min(100, driftAbs * 5) + '%', height: '100%', background: driftColor, borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 12, color: driftColor, fontVariantNumeric: 'tabular-nums', minWidth: 50, textAlign: 'right', fontWeight: driftAbs >= 3 ? 700 : 400 }}>
                                {r.drift > 0 ? '+' : ''}{r.drift.toFixed(1)}%
                              </span>
                            </div>
                          ) : <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>—</span>}
                        </td>
                        <td className="num" style={{ color: 'var(--fg-3)' }}>
                          {r.tgtPct > 0 ? sym + window.fmtBig(tgtValue) : '—'}
                        </td>
                        <td className="num">
                          {r.tgtPct > 0 && Math.abs(r.delta) > 1 ? (
                            <span style={{ fontWeight: 700, fontSize: 12,
                              color: r.delta > 0 ? 'var(--green-600)' : 'var(--red-600)',
                              background: r.delta > 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                              padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                              {r.delta > 0 ? '▲ Buy ' : '▼ Sell '}{sym}{window.fmtBig(Math.abs(r.delta))}
                            </span>
                          ) : r.tgtPct > 0 ? (
                            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>On target ✓</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-sunken)' }}>
                    <td style={{ fontWeight: 700, padding: '10px 18px', fontSize: 13 }}>Total</td>
                    <td className="num" style={{ fontWeight: 700 }}>{sym}{window.fmtBig(totalValue)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>100.0%</td>
                    <td className="num" style={{ fontWeight: 700, color: Math.abs(totalTarget - 100) < 0.1 ? 'var(--green-600)' : 'var(--red-600)' }}>
                      {totalTarget.toFixed(1)}%
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}
