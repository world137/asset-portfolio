/* eslint-disable */
/* PlanningView.jsx — Features #15-16: Retirement/FIRE Calculator & DCA Planner */

// ── DCA Simulation helper ─────────────────────────────────────────────────────
function simulateDCA(startValue, monthlyContrib, annualReturnPct, years) {
  const monthlyRate = annualReturnPct / 100 / 12;
  const points = [{ year: 0, value: startValue, contributed: 0 }];
  let value = startValue;
  let totalContrib = 0;
  for (let m = 1; m <= years * 12; m++) {
    value = value * (1 + monthlyRate) + monthlyContrib;
    totalContrib += monthlyContrib;
    if (m % 12 === 0) {
      points.push({ year: m / 12, value, contributed: totalContrib });
    }
  }
  return points;
}

// ── Retirement / FIRE Calculator ─────────────────────────────────────────────
function RetirementCalc() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const portValue = Store.grandTotals().value;

  const [currentAge,     setCurrentAge]     = React.useState('30');
  const [retireAge,      setRetireAge]       = React.useState('55');
  const [monthlyExpense, setMonthlyExpense]  = React.useState('50000');
  const [annualReturn,   setAnnualReturn]    = React.useState('8');
  const [inflation,      setInflation]       = React.useState('3');
  const [withdrawalRate, setWithdrawalRate]  = React.useState('4');
  const [monthlyContrib, setMonthlyContrib]  = React.useState('20000');

  const curAge   = parseFloat(currentAge)   || 30;
  const retAge   = parseFloat(retireAge)    || 55;
  const mExp     = parseFloat(monthlyExpense) || 50000;
  const annRet   = parseFloat(annualReturn) || 8;
  const inf      = parseFloat(inflation)    || 3;
  const wdRate   = parseFloat(withdrawalRate) || 4;
  const mContrib = parseFloat(monthlyContrib) || 20000;

  const yearsToRetire = Math.max(0, retAge - curAge);

  // Annual expense at retirement (inflation adjusted)
  const annualExpAtRetire = mExp * 12 * Math.pow(1 + inf / 100, yearsToRetire);

  // FIRE number: annual expense / withdrawal rate
  const fireNumber = annualExpAtRetire / (wdRate / 100);

  // Project portfolio with monthly contribution
  const projPoints = simulateDCA(portValue, mContrib, annRet, yearsToRetire);
  const projValueAtRetire = projPoints.length ? projPoints[projPoints.length - 1].value : portValue;

  const gap      = fireNumber - projValueAtRetire;
  const onTrack  = projValueAtRetire >= fireNumber;

  // Years until FIRE number reached (with contrib)
  let yearsToFire = null;
  const longProj = simulateDCA(portValue, mContrib, annRet, 60);
  for (const p of longProj) {
    if (p.value >= fireNumber) { yearsToFire = p.year; break; }
  }

  // Safe withdrawal monthly income
  const monthlyIncome = projValueAtRetire * (wdRate / 100) / 12;

  // Canvas chart
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || projPoints.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const PAD = { top: 20, right: 16, bottom: 28, left: 60 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;
    const maxVal = Math.max(fireNumber * 1.1, projPoints[projPoints.length - 1].value * 1.05);
    const xOf = i => PAD.left + (i / (projPoints.length - 1)) * cw;
    const yOf = v => PAD.top + ch * (1 - v / maxVal);

    // Fire target line
    const fireY = yOf(fireNumber);
    ctx.save();
    ctx.strokeStyle = 'rgba(22,163,74,0.5)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, fireY); ctx.lineTo(PAD.left + cw, fireY); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(22,163,74,0.8)';
    ctx.font = '10px var(--font-sans, sans-serif)';
    ctx.fillText('FIRE target', PAD.left + 4, fireY - 4);

    // Grid
    ctx.strokeStyle = 'rgba(128,128,128,0.1)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = yOf(maxVal * f);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cw, y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = '9px var(--font-mono, monospace)';
      ctx.textAlign = 'right';
      const v = maxVal * f;
      ctx.fillText(v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K', PAD.left - 4, y + 3);
    });

    // Portfolio curve
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    grad.addColorStop(0, 'rgba(59,130,246,0.3)');
    grad.addColorStop(1, 'rgba(59,130,246,0.01)');
    ctx.beginPath();
    projPoints.forEach((p, i) => { if (i === 0) ctx.moveTo(xOf(i), yOf(p.value)); else ctx.lineTo(xOf(i), yOf(p.value)); });
    ctx.lineTo(xOf(projPoints.length - 1), PAD.top + ch);
    ctx.lineTo(xOf(0), PAD.top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    projPoints.forEach((p, i) => { if (i === 0) ctx.moveTo(xOf(i), yOf(p.value)); else ctx.lineTo(xOf(i), yOf(p.value)); });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();

    // X labels
    ctx.fillStyle = 'rgba(128,128,128,0.65)';
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    [0, Math.round(projPoints.length / 2) - 1, projPoints.length - 1].forEach(i => {
      if (projPoints[i]) ctx.fillText(`Age ${curAge + projPoints[i].year}`, xOf(i), H - 4);
    });
  }, [projPoints, fireNumber]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {[
          { label: 'Current age', value: currentAge, set: setCurrentAge, min: 1, max: 100 },
          { label: 'Retirement age', value: retireAge, set: setRetireAge, min: 1, max: 100 },
          { label: 'Monthly expenses (now, THB)', value: monthlyExpense, set: setMonthlyExpense, min: 0 },
          { label: 'Monthly contribution (THB)', value: monthlyContrib, set: setMonthlyContrib, min: 0 },
          { label: 'Expected annual return %', value: annualReturn, set: setAnnualReturn, min: 0, max: 50 },
          { label: 'Expected inflation %', value: inflation, set: setInflation, min: 0, max: 20 },
          { label: 'Withdrawal rate %', value: withdrawalRate, set: setWithdrawalRate, min: 1, max: 10 },
        ].map(f => (
          <div key={f.label}>
            <label className="form-label" style={{ fontSize: 11 }}>{f.label}</label>
            <input type="number" min={f.min} max={f.max} step="any" value={f.value}
                   onChange={e => f.set(e.target.value)} />
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className={'kpi ' + (onTrack ? 'accent' : '')} style={{ borderColor: onTrack ? 'var(--green-600)' : 'var(--red-600)' }}>
          <div className="lab">FIRE Number</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(fireNumber)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>at {wdRate}% withdrawal</div>
        </div>
        <div className="kpi">
          <div className="lab">Projected at {retAge}</div>
          <div className="big" style={{ color: onTrack ? 'var(--green-600)' : '#f59e0b' }}>
            <span className="ccy">{sym}</span>{window.fmtBig(projValueAtRetire)}
          </div>
          <div className={'delta ' + (onTrack ? 'up' : 'down')}>
            {onTrack ? '✓ On track' : `Gap: ${sym}${window.fmtBig(gap)}`}
          </div>
        </div>
        <div className="kpi">
          <div className="lab">Monthly income at retire</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(monthlyIncome)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>safe withdrawal</div>
        </div>
        <div className="kpi">
          <div className="lab">FIRE reached in</div>
          <div className="big">{yearsToFire !== null ? yearsToFire + ' years' : '> 60 yrs'}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{yearsToFire !== null ? `Age ${Math.round(curAge + yearsToFire)}` : 'Increase contributions'}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div className="card-h"><div className="t">Portfolio growth projection</div><div className="s">Current value + {sym}{window.fmtBig(mContrib)}/month at {annRet}% return</div></div>
        <div style={{ padding: '8px', height: 200 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

// ── DCA Planner ───────────────────────────────────────────────────────────────
function DCAPlanner() {
  const store    = useStore();
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);
  const portValue = Store.grandTotals().value;

  const [initialInvest, setInitialInvest] = React.useState(String(Math.round(portValue)));
  const [monthly,       setMonthly]       = React.useState('10000');
  const [years,         setYears]         = React.useState('10');
  const [returnPct,     setReturnPct]     = React.useState('8');

  const init  = parseFloat(initialInvest) || 0;
  const mo    = parseFloat(monthly)       || 0;
  const yrs   = Math.min(60, parseFloat(years) || 10);
  const ret   = parseFloat(returnPct)     || 8;

  const points    = simulateDCA(init, mo, ret, yrs);
  const finalVal  = points.length ? points[points.length - 1].value : 0;
  const totalInvested = init + mo * yrs * 12;
  const totalGrowth   = finalVal - totalInvested;

  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const PAD = { top: 20, right: 16, bottom: 28, left: 60 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;
    const maxVal = finalVal * 1.05;
    const xOf = i => PAD.left + (i / (points.length - 1)) * cw;
    const yOf = v => PAD.top + ch * (1 - v / maxVal);

    // Contribution fill
    const gradCon = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    gradCon.addColorStop(0, 'rgba(107,114,128,0.2)');
    gradCon.addColorStop(1, 'rgba(107,114,128,0.03)');
    ctx.beginPath();
    points.forEach((p, i) => {
      const contribTotal = init + mo * p.year * 12;
      if (i === 0) ctx.moveTo(xOf(i), yOf(contribTotal)); else ctx.lineTo(xOf(i), yOf(contribTotal));
    });
    ctx.lineTo(xOf(points.length - 1), PAD.top + ch);
    ctx.lineTo(xOf(0), PAD.top + ch);
    ctx.closePath();
    ctx.fillStyle = gradCon;
    ctx.fill();

    // Value fill
    const gradVal = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    gradVal.addColorStop(0, 'rgba(59,130,246,0.3)');
    gradVal.addColorStop(1, 'rgba(59,130,246,0.01)');
    ctx.beginPath();
    points.forEach((p, i) => { if (i === 0) ctx.moveTo(xOf(i), yOf(p.value)); else ctx.lineTo(xOf(i), yOf(p.value)); });
    ctx.lineTo(xOf(points.length - 1), PAD.top + ch);
    ctx.lineTo(xOf(0), PAD.top + ch);
    ctx.closePath();
    ctx.fillStyle = gradVal;
    ctx.fill();

    // Lines
    [[points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) })), '#3b82f6', 2],
     [points.map((p, i) => { const c = init + mo * p.year * 12; return { x: xOf(i), y: yOf(c) }; }), '#6b7280', 1.5],
    ].forEach(([pts, color, lw]) => {
      ctx.beginPath();
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash([]); ctx.stroke();
    });

    // Grid labels
    ctx.fillStyle = 'rgba(128,128,128,0.6)';
    ctx.font = '9px var(--font-mono, monospace)';
    ctx.textAlign = 'right';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const v = maxVal * f;
      const y = yOf(v);
      ctx.fillText(v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K', PAD.left - 4, y + 3);
      ctx.strokeStyle = 'rgba(128,128,128,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cw, y); ctx.stroke();
    });
    ctx.textAlign = 'center';
    [0, Math.round(points.length / 2) - 1, points.length - 1].forEach(i => {
      if (points[i]) {
        ctx.fillText('Yr ' + points[i].year, xOf(i), H - 4);
      }
    });
  }, [points, finalVal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { label: 'Initial investment (THB)', value: initialInvest, set: setInitialInvest },
          { label: 'Monthly contribution (THB)', value: monthly,   set: setMonthly },
          { label: 'Investment period (years)',  value: years,      set: setYears, min: 1, max: 60 },
          { label: 'Expected annual return %',   value: returnPct,  set: setReturnPct, min: 0, max: 50 },
        ].map(f => (
          <div key={f.label}>
            <label className="form-label" style={{ fontSize: 11 }}>{f.label}</label>
            <input type="number" step="any" min={f.min || 0} max={f.max} value={f.value}
                   onChange={e => f.set(e.target.value)} />
          </div>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi accent">
          <div className="lab">Final Value ({yrs}Y)</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(finalVal)}</div>
          <div className="delta up">×{(finalVal / (init || 1)).toFixed(1)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Total Invested</div>
          <div className="big"><span className="ccy">{sym}</span>{window.fmtBig(totalInvested)}</div>
          <div className="delta" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(init)} + {sym}{window.fmtBig(mo)}/mo</div>
        </div>
        <div className="kpi">
          <div className="lab">Investment Growth</div>
          <div className="big up"><span className="ccy">{sym}</span>{window.fmtBig(totalGrowth)}</div>
          <div className="delta up">{totalInvested > 0 ? '+' + ((totalGrowth / totalInvested) * 100).toFixed(0) + '%' : ''}</div>
        </div>
      </div>

      {/* Year-by-year table */}
      <div className="card">
        <div className="card-h"><div className="t">Growth chart</div><div className="s">Blue = portfolio value · Gray = total invested</div></div>
        <div style={{ padding: '8px', height: 200 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="t">Year-by-year breakdown</div></div>
        <div style={{ overflowX: 'auto', maxHeight: 300 }}>
          <table className="ptable" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Portfolio Value</th>
                <th className="num">Total Invested</th>
                <th className="num">Growth</th>
                <th className="num">Growth %</th>
              </tr>
            </thead>
            <tbody>
              {points.filter(p => p.year > 0).map(p => {
                const invested = init + mo * p.year * 12;
                const growth   = p.value - invested;
                return (
                  <tr key={p.year} className="pos">
                    <td style={{ fontWeight: 600 }}>Year {p.year}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{sym}{window.fmtBig(p.value)}</td>
                    <td className="num" style={{ color: 'var(--fg-3)' }}>{sym}{window.fmtBig(invested)}</td>
                    <td className="num up">{sym}{window.fmtBig(growth)}</td>
                    <td className="num up">{invested > 0 ? '+' + ((growth / invested) * 100).toFixed(1) + '%' : '—'}</td>
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

// ── Main view ─────────────────────────────────────────────────────────────────
function PlanningView() {
  const [tab, setTab] = React.useState('fire');

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Planning & Projections</h1>
        <div className="t-small">Retirement & FIRE calculator · DCA planner · projected growth scenarios</div>
      </div>

      <div className="layoutseg" style={{ marginBottom: 20 }}>
        <button className={tab === 'fire' ? 'on' : ''} onClick={() => setTab('fire')}>FIRE Calculator</button>
        <button className={tab === 'dca'  ? 'on' : ''} onClick={() => setTab('dca')}>DCA Planner</button>
      </div>

      {tab === 'fire' && <RetirementCalc />}
      {tab === 'dca'  && <DCAPlanner />}
    </div>
  );
}
