/* eslint-disable */
/* DividendCalendar.jsx — Portfolio Calendar: dividends + economic events */

// ── Economic events data (2025–2026) ──────────────────────────────────────────
// Type color map for badges
const ECO_TYPE_COLORS = {
  fomc:   { bg: '#7c3aed', text: '#fff', label: 'FOMC' },
  cpi:    { bg: '#2563eb', text: '#fff', label: 'CPI' },
  nfp:    { bg: '#059669', text: '#fff', label: 'NFP' },
  pce:    { bg: '#0891b2', text: '#fff', label: 'PCE' },
  gdp:    { bg: '#d97706', text: '#fff', label: 'GDP' },
  pmi:    { bg: '#64748b', text: '#fff', label: 'PMI' },
  retail: { bg: '#db2777', text: '#fff', label: 'Retail' },
  other:  { bg: '#6b7280', text: '#fff', label: 'Eco' },
};

// Hardcoded major US economic events 2026
// Dates: FOMC=decision day, CPI=release day, NFP=first Friday, PCE=end-of-month Friday
const HARDCODED_ECO_EVENTS = [
  // FOMC 2026 (8 meetings)
  { date: '2026-01-28', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-03-18', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-04-29', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-06-10', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-07-29', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-09-16', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-10-28', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2026-12-09', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  // CPI 2026 (monthly)
  { date: '2026-01-14', type: 'cpi', label: 'CPI Inflation (Dec)', importance: 'high' },
  { date: '2026-02-11', type: 'cpi', label: 'CPI Inflation (Jan)', importance: 'high' },
  { date: '2026-03-11', type: 'cpi', label: 'CPI Inflation (Feb)', importance: 'high' },
  { date: '2026-04-13', type: 'cpi', label: 'CPI Inflation (Mar)', importance: 'high' },
  { date: '2026-05-13', type: 'cpi', label: 'CPI Inflation (Apr)', importance: 'high' },
  { date: '2026-06-11', type: 'cpi', label: 'CPI Inflation (May)', importance: 'high' },
  { date: '2026-07-14', type: 'cpi', label: 'CPI Inflation (Jun)', importance: 'high' },
  { date: '2026-08-12', type: 'cpi', label: 'CPI Inflation (Jul)', importance: 'high' },
  { date: '2026-09-11', type: 'cpi', label: 'CPI Inflation (Aug)', importance: 'high' },
  { date: '2026-10-14', type: 'cpi', label: 'CPI Inflation (Sep)', importance: 'high' },
  { date: '2026-11-12', type: 'cpi', label: 'CPI Inflation (Oct)', importance: 'high' },
  { date: '2026-12-11', type: 'cpi', label: 'CPI Inflation (Nov)', importance: 'high' },
  // NFP 2026 (first Friday)
  { date: '2026-01-09', type: 'nfp', label: 'Jobs Report (Dec)', importance: 'high' },
  { date: '2026-02-06', type: 'nfp', label: 'Jobs Report (Jan)', importance: 'high' },
  { date: '2026-03-06', type: 'nfp', label: 'Jobs Report (Feb)', importance: 'high' },
  { date: '2026-04-03', type: 'nfp', label: 'Jobs Report (Mar)', importance: 'high' },
  { date: '2026-05-01', type: 'nfp', label: 'Jobs Report (Apr)', importance: 'high' },
  { date: '2026-06-05', type: 'nfp', label: 'Jobs Report (May)', importance: 'high' },
  { date: '2026-07-10', type: 'nfp', label: 'Jobs Report (Jun)', importance: 'high' },
  { date: '2026-08-07', type: 'nfp', label: 'Jobs Report (Jul)', importance: 'high' },
  { date: '2026-09-04', type: 'nfp', label: 'Jobs Report (Aug)', importance: 'high' },
  { date: '2026-10-02', type: 'nfp', label: 'Jobs Report (Sep)', importance: 'high' },
  { date: '2026-11-06', type: 'nfp', label: 'Jobs Report (Oct)', importance: 'high' },
  { date: '2026-12-04', type: 'nfp', label: 'Jobs Report (Nov)', importance: 'high' },
  // PCE 2026 (late-month Fridays)
  { date: '2026-01-30', type: 'pce', label: 'PCE Inflation (Dec)', importance: 'medium' },
  { date: '2026-02-27', type: 'pce', label: 'PCE Inflation (Jan)', importance: 'medium' },
  { date: '2026-03-27', type: 'pce', label: 'PCE Inflation (Feb)', importance: 'medium' },
  { date: '2026-04-30', type: 'pce', label: 'PCE Inflation (Mar)', importance: 'medium' },
  { date: '2026-05-29', type: 'pce', label: 'PCE Inflation (Apr)', importance: 'medium' },
  { date: '2026-06-26', type: 'pce', label: 'PCE Inflation (May)', importance: 'medium' },
  { date: '2026-07-31', type: 'pce', label: 'PCE Inflation (Jun)', importance: 'medium' },
  { date: '2026-08-28', type: 'pce', label: 'PCE Inflation (Jul)', importance: 'medium' },
  { date: '2026-09-25', type: 'pce', label: 'PCE Inflation (Aug)', importance: 'medium' },
  { date: '2026-10-30', type: 'pce', label: 'PCE Inflation (Sep)', importance: 'medium' },
  { date: '2026-11-25', type: 'pce', label: 'PCE Inflation (Oct)', importance: 'medium' },
  { date: '2026-12-18', type: 'pce', label: 'PCE Inflation (Nov)', importance: 'medium' },
  // GDP 2026 (quarterly advance estimates)
  { date: '2026-01-29', type: 'gdp', label: 'GDP Q4 2025 (Advance)', importance: 'medium' },
  { date: '2026-04-29', type: 'gdp', label: 'GDP Q1 2026 (Advance)', importance: 'medium' },
  { date: '2026-07-30', type: 'gdp', label: 'GDP Q2 2026 (Advance)', importance: 'medium' },
  { date: '2026-10-29', type: 'gdp', label: 'GDP Q3 2026 (Advance)', importance: 'medium' },
  // PMI 2026 (1st biz day of each month)
  { date: '2026-01-02', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-02-02', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-03-02', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-04-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-05-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-06-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-07-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-08-03', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-09-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-10-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-11-02', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2026-12-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  // Retail Sales 2026 (~mid-month)
  { date: '2026-01-15', type: 'retail', label: 'Retail Sales (Dec)', importance: 'low' },
  { date: '2026-02-13', type: 'retail', label: 'Retail Sales (Jan)', importance: 'low' },
  { date: '2026-03-13', type: 'retail', label: 'Retail Sales (Feb)', importance: 'low' },
  { date: '2026-04-15', type: 'retail', label: 'Retail Sales (Mar)', importance: 'low' },
  { date: '2026-05-15', type: 'retail', label: 'Retail Sales (Apr)', importance: 'low' },
  { date: '2026-06-12', type: 'retail', label: 'Retail Sales (May)', importance: 'low' },
  { date: '2026-07-16', type: 'retail', label: 'Retail Sales (Jun)', importance: 'low' },
  { date: '2026-08-14', type: 'retail', label: 'Retail Sales (Jul)', importance: 'low' },
  { date: '2026-09-15', type: 'retail', label: 'Retail Sales (Aug)', importance: 'low' },
  { date: '2026-10-14', type: 'retail', label: 'Retail Sales (Sep)', importance: 'low' },
  { date: '2026-11-13', type: 'retail', label: 'Retail Sales (Oct)', importance: 'low' },
  { date: '2026-12-11', type: 'retail', label: 'Retail Sales (Nov)', importance: 'low' },

  // ── 2027 ──────────────────────────────────────────────────────────────────────
  // FOMC 2027 (8 meetings — decision days)
  { date: '2027-01-27', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-03-17', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-04-28', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-06-16', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-07-28', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-09-15', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-10-27', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  { date: '2027-12-15', type: 'fomc', label: 'FOMC Rate Decision', importance: 'high' },
  // CPI 2027 (monthly — approx 2nd Wednesday)
  { date: '2027-01-13', type: 'cpi', label: 'CPI Inflation (Dec)', importance: 'high' },
  { date: '2027-02-10', type: 'cpi', label: 'CPI Inflation (Jan)', importance: 'high' },
  { date: '2027-03-10', type: 'cpi', label: 'CPI Inflation (Feb)', importance: 'high' },
  { date: '2027-04-14', type: 'cpi', label: 'CPI Inflation (Mar)', importance: 'high' },
  { date: '2027-05-12', type: 'cpi', label: 'CPI Inflation (Apr)', importance: 'high' },
  { date: '2027-06-09', type: 'cpi', label: 'CPI Inflation (May)', importance: 'high' },
  { date: '2027-07-14', type: 'cpi', label: 'CPI Inflation (Jun)', importance: 'high' },
  { date: '2027-08-11', type: 'cpi', label: 'CPI Inflation (Jul)', importance: 'high' },
  { date: '2027-09-08', type: 'cpi', label: 'CPI Inflation (Aug)', importance: 'high' },
  { date: '2027-10-13', type: 'cpi', label: 'CPI Inflation (Sep)', importance: 'high' },
  { date: '2027-11-10', type: 'cpi', label: 'CPI Inflation (Oct)', importance: 'high' },
  { date: '2027-12-08', type: 'cpi', label: 'CPI Inflation (Nov)', importance: 'high' },
  // NFP 2027 (first Friday of each month)
  { date: '2027-01-08', type: 'nfp', label: 'Jobs Report (Dec)', importance: 'high' },
  { date: '2027-02-05', type: 'nfp', label: 'Jobs Report (Jan)', importance: 'high' },
  { date: '2027-03-05', type: 'nfp', label: 'Jobs Report (Feb)', importance: 'high' },
  { date: '2027-04-02', type: 'nfp', label: 'Jobs Report (Mar)', importance: 'high' },
  { date: '2027-05-07', type: 'nfp', label: 'Jobs Report (Apr)', importance: 'high' },
  { date: '2027-06-04', type: 'nfp', label: 'Jobs Report (May)', importance: 'high' },
  { date: '2027-07-02', type: 'nfp', label: 'Jobs Report (Jun)', importance: 'high' },
  { date: '2027-08-06', type: 'nfp', label: 'Jobs Report (Jul)', importance: 'high' },
  { date: '2027-09-03', type: 'nfp', label: 'Jobs Report (Aug)', importance: 'high' },
  { date: '2027-10-01', type: 'nfp', label: 'Jobs Report (Sep)', importance: 'high' },
  { date: '2027-11-05', type: 'nfp', label: 'Jobs Report (Oct)', importance: 'high' },
  { date: '2027-12-03', type: 'nfp', label: 'Jobs Report (Nov)', importance: 'high' },
  // PCE 2027 (late-month Fridays)
  { date: '2027-01-29', type: 'pce', label: 'PCE Inflation (Dec)', importance: 'medium' },
  { date: '2027-02-26', type: 'pce', label: 'PCE Inflation (Jan)', importance: 'medium' },
  { date: '2027-03-26', type: 'pce', label: 'PCE Inflation (Feb)', importance: 'medium' },
  { date: '2027-04-30', type: 'pce', label: 'PCE Inflation (Mar)', importance: 'medium' },
  { date: '2027-05-28', type: 'pce', label: 'PCE Inflation (Apr)', importance: 'medium' },
  { date: '2027-06-25', type: 'pce', label: 'PCE Inflation (May)', importance: 'medium' },
  { date: '2027-07-30', type: 'pce', label: 'PCE Inflation (Jun)', importance: 'medium' },
  { date: '2027-08-27', type: 'pce', label: 'PCE Inflation (Jul)', importance: 'medium' },
  { date: '2027-09-24', type: 'pce', label: 'PCE Inflation (Aug)', importance: 'medium' },
  { date: '2027-10-29', type: 'pce', label: 'PCE Inflation (Sep)', importance: 'medium' },
  { date: '2027-11-26', type: 'pce', label: 'PCE Inflation (Oct)', importance: 'medium' },
  { date: '2027-12-17', type: 'pce', label: 'PCE Inflation (Nov)', importance: 'medium' },
  // GDP 2027 (quarterly advance estimates)
  { date: '2027-01-28', type: 'gdp', label: 'GDP Q4 2026 (Advance)', importance: 'medium' },
  { date: '2027-04-29', type: 'gdp', label: 'GDP Q1 2027 (Advance)', importance: 'medium' },
  { date: '2027-07-29', type: 'gdp', label: 'GDP Q2 2027 (Advance)', importance: 'medium' },
  { date: '2027-10-28', type: 'gdp', label: 'GDP Q3 2027 (Advance)', importance: 'medium' },
  // PMI 2027 (first business day of each month)
  { date: '2027-01-04', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-02-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-03-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-04-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-05-03', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-06-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-07-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-08-02', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-09-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-10-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-11-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  { date: '2027-12-01', type: 'pmi', label: 'ISM Manufacturing PMI', importance: 'low' },
  // Retail Sales 2027 (~mid-month)
  { date: '2027-01-14', type: 'retail', label: 'Retail Sales (Dec)', importance: 'low' },
  { date: '2027-02-11', type: 'retail', label: 'Retail Sales (Jan)', importance: 'low' },
  { date: '2027-03-11', type: 'retail', label: 'Retail Sales (Feb)', importance: 'low' },
  { date: '2027-04-14', type: 'retail', label: 'Retail Sales (Mar)', importance: 'low' },
  { date: '2027-05-12', type: 'retail', label: 'Retail Sales (Apr)', importance: 'low' },
  { date: '2027-06-09', type: 'retail', label: 'Retail Sales (May)', importance: 'low' },
  { date: '2027-07-14', type: 'retail', label: 'Retail Sales (Jun)', importance: 'low' },
  { date: '2027-08-11', type: 'retail', label: 'Retail Sales (Jul)', importance: 'low' },
  { date: '2027-09-09', type: 'retail', label: 'Retail Sales (Aug)', importance: 'low' },
  { date: '2027-10-14', type: 'retail', label: 'Retail Sales (Sep)', importance: 'low' },
  { date: '2027-11-11', type: 'retail', label: 'Retail Sales (Oct)', importance: 'low' },
  { date: '2027-12-10', type: 'retail', label: 'Retail Sales (Nov)', importance: 'low' },
];

// ── Economic event modal ───────────────────────────────────────────────────────
function EcoEventModal({ item, onClose }) {
  const isEdit = !!item;
  const [date,  setDate]  = React.useState(item ? item.date  : '');
  const [type,  setType]  = React.useState(item ? item.type  : 'other');
  const [label, setLabel] = React.useState(item ? item.label : '');
  const [importance, setImportance] = React.useState(item ? (item.importance || 'medium') : 'medium');
  const [note,  setNote]  = React.useState(item ? (item.note || '') : '');

  function save() {
    if (!date || !label) return;
    const data = { date, type, label, importance, note: note || undefined };
    if (isEdit) Store.updateEcoEvent(item.id, data);
    else Store.addEcoEvent(data);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit event' : 'Add economic event'} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="form-label">Date *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-label">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {Object.entries(ECO_TYPE_COLORS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Importance</label>
            <select value={importance} onChange={e => setImportance(e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div>
          <label className="form-label">Label *</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. FOMC Rate Decision" />
        </div>
        <div>
          <label className="form-label">Note</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note…" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={!date || !label}>
            {isEdit ? 'Save changes' : 'Add event'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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

  const [fetching, setFetching] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setFetching(true);
    Promise.resolve(Store.fetchDividends()).finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, []);

  function syncDividends() {
    setFetching(true);
    Promise.resolve(Store.fetchDividends(true)).finally(() => setFetching(false));
  }

  // Merge manual + auto dividends (manual takes priority for same holding+date)
  const manual = Store.getDividends();
  const auto   = Store.getAutoDividends();
  const dividends = [
    ...manual,
    ...auto.filter(a => !manual.some(m =>
      m.classKey === a.classKey && m.name === a.name &&
      (m.exDate === a.exDate || m.payDate === a.payDate))),
  ];
  const fetchedAt = Store.getDividendFetchedAt();

  // Eco events: hardcoded schedule + user-added custom events
  const customEcoEvents = Store.getEcoEvents ? Store.getEcoEvents() : [];
  const allEcoEvents = [...HARDCODED_ECO_EVENTS, ...customEcoEvents];

  const [divModalOpen,  setDivModalOpen]  = React.useState(false);
  const [ecoModalOpen,  setEcoModalOpen]  = React.useState(false);
  const [editItem,      setEditItem]      = React.useState(null);
  const [editEcoItem,   setEditEcoItem]   = React.useState(null);
  const [showEcoTypes,  setShowEcoTypes]  = React.useState(
    () => Object.fromEntries(Object.keys(ECO_TYPE_COLORS).map(k => [k, true]))
  );
  const [viewMonth,   setViewMonth]   = React.useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  const [tab, setTab] = React.useState('calendar');

  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 900);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [selectedDay, setSelectedDay] = React.useState(null);
  React.useEffect(() => { setSelectedDay(null); }, [viewMonth]);

  const [year, mon] = viewMonth.split('-').map(Number);

  function changeMonth(delta) {
    const d = new Date(year, mon - 1 + delta, 1);
    setViewMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const sorted = [...dividends].sort((a, b) => (a.payDate || '').localeCompare(b.payDate || ''));
  const monthPrefix = viewMonth;
  const thisMonth   = sorted.filter(d => (d.payDate || '').startsWith(monthPrefix));

  const USDTHB = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;
  function toTHB(amount, ccy) { return ccy === 'USD' ? (amount || 0) * USDTHB : (amount || 0); }
  function toDisplay(amount, ccy) { return Store.toDisplay(toTHB(amount, ccy), 'THB'); }
  function effectiveAmount(d) {
    const raw = d.totalAmount || (d.amountPerShare ? d.amountPerShare * ((Store.positions(d.classKey).find(p => p.name === d.name) || {}).qty || 0) : 0);
    return toDisplay(raw, d.currency);
  }

  const totalThisMonth = thisMonth.reduce((a, d) => a + effectiveAmount(d), 0);

  const firstDay  = new Date(year, mon - 1, 1).getDay();
  const daysInMon = new Date(year, mon, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function payLabel(d) {
    return d.name + (d.totalAmount ? ` · ${sym}${window.fmtBig(effectiveAmount(d))}` : '');
  }

  const curYear = new Date().getFullYear();
  const yearDivs = sorted.filter(d => (d.payDate || '').startsWith(String(curYear)));
  const tickerMap = new Map();
  for (const d of yearDivs) {
    const key = d.classKey + ':' + d.name;
    const amt = effectiveAmount(d);
    if (!tickerMap.has(key)) tickerMap.set(key, { name: d.name, classKey: d.classKey, total: 0, count: 0 });
    const e = tickerMap.get(key); e.total += amt; e.count++;
  }
  const tickerRows = [...tickerMap.values()].sort((a, b) => b.total - a.total);
  const yearTotal  = tickerRows.reduce((a, r) => a + r.total, 0);

  // Filtered eco events for the current month
  const monthEcoEvents = allEcoEvents.filter(e => e.date && e.date.startsWith(monthPrefix) && showEcoTypes[e.type]);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Portfolio Calendar</h1>
          <div className="t-small">
            Dividends auto-synced via Yahoo Finance · Economic events schedule
            {fetchedAt ? ` · updated ${window.timeAgo(fetchedAt)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" icon="history" onClick={syncDividends} disabled={fetching}>
            {fetching ? 'Syncing…' : 'Sync'}
          </Button>
          <Button variant="secondary" size="sm" icon="calendar" onClick={() => { setEditEcoItem(null); setEcoModalOpen(true); }}>Add event</Button>
          <Button size="sm" icon="plus" onClick={() => { setEditItem(null); setDivModalOpen(true); }}>Add dividend</Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="layoutseg" style={{ marginBottom: 16 }}>
        <button className={tab === 'calendar' ? 'on' : ''} onClick={() => setTab('calendar')}>Calendar</button>
        <button className={tab === 'dividends' ? 'on' : ''} onClick={() => setTab('dividends')}>Dividends</button>
        <button className={tab === 'events'   ? 'on' : ''} onClick={() => setTab('events')}>Eco Events</button>
        <button className={tab === 'summary'  ? 'on' : ''} onClick={() => setTab('summary')}>Summary</button>
      </div>

      {/* ── CALENDAR TAB ─────────────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <React.Fragment>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <button className="icon-toggle" onClick={() => changeMonth(-1)}><Icon name="chevron-left" size={16} /></button>
            <span style={{ fontWeight: 700, fontSize: 16, minWidth: 160, textAlign: 'center' }}>
              {MONTHS[mon - 1]} {year}
            </span>
            <button className="icon-toggle" onClick={() => changeMonth(1)}><Icon name="chevron-right" size={16} /></button>
            {totalThisMonth > 0 && (
              <span style={{ marginLeft: 4, fontSize: 13, color: 'var(--green-600)', fontWeight: 600 }}>
                💰 {sym}{window.fmtBig(totalThisMonth)}
              </span>
            )}
            {monthEcoEvents.length > 0 && (
              <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                · {monthEcoEvents.length} eco event{monthEcoEvents.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Eco event type filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {Object.entries(ECO_TYPE_COLORS).map(([k, v]) => (
              <button key={k} onClick={() => setShowEcoTypes(s => ({ ...s, [k]: !s[k] }))}
                style={{
                  padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid ' + (showEcoTypes[k] ? v.bg : 'var(--border-2)'),
                  background: showEcoTypes[k] ? v.bg : 'transparent',
                  color: showEcoTypes[k] ? v.text : 'var(--fg-3)',
                  opacity: showEcoTypes[k] ? 1 : 0.5,
                }}>
                {v.label}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-1)' }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: isMobile ? '6px 2px' : '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-3)' }}>
                  {isMobile ? d[0] : d}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={'e' + i} style={{ minHeight: isMobile ? 52 : 80, borderRight: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)', overflow: 'hidden', minWidth: 0 }} />;
                const dayStr = viewMonth + '-' + String(day).padStart(2, '0');
                const dayDivs = sorted.filter(d => d.payDate === dayStr || d.exDate === dayStr);
                const dayEco  = allEcoEvents.filter(e => e.date === dayStr && showEcoTypes[e.type]);
                const isToday = dayStr === new Date().toISOString().slice(0, 10);
                const hasEvents = dayDivs.length > 0 || dayEco.length > 0;
                return (
                  <div key={day} style={{
                    minHeight: isMobile ? 52 : 80,
                    padding: isMobile ? '4px 2px' : '6px 4px',
                    borderRight: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)',
                    background: isToday ? 'var(--accent-bg, rgba(59,130,246,0.07))' : 'transparent',
                    overflow: 'hidden', minWidth: 0,
                  }}>
                    <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--fg-3)', marginBottom: isMobile ? 2 : 3, textAlign: isMobile ? 'center' : 'left' }}>{day}</div>
                    {isMobile ? (
                      /* ── Dot mode for mobile ── */
                      hasEvents && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                          {dayDivs.map(d => (
                            <div key={d.id} title={payLabel(d)}
                                 style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                   background: d.payDate === dayStr ? 'var(--green-600)' : 'var(--fg-4)',
                                   opacity: d.auto ? 0.8 : 1, cursor: 'pointer' }}
                                 onClick={() => setSelectedDay(s => s === dayStr ? null : dayStr)} />
                          ))}
                          {dayEco.map((e, ei) => {
                            const tc = ECO_TYPE_COLORS[e.type] || ECO_TYPE_COLORS.other;
                            return (
                              <div key={e.id || e.label + ei} title={e.label + (e.note ? ' · ' + e.note : '')}
                                   style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                     background: tc.bg, opacity: e.importance === 'low' ? 0.6 : 1,
                                     cursor: 'pointer' }}
                                   onClick={() => setSelectedDay(s => s === dayStr ? null : dayStr)} />
                            );
                          })}
                        </div>
                      )
                    ) : (
                      /* ── Full badge mode for desktop ── */
                      <React.Fragment>
                        {dayDivs.map(d => (
                          <div key={d.id} title={payLabel(d)}
                               style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, marginBottom: 2,
                                 background: d.payDate === dayStr ? 'var(--green-600)' : 'var(--fg-4)',
                                 color: '#fff', cursor: d.auto ? 'default' : 'pointer',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                 opacity: d.auto ? 0.85 : 1 }}
                               onClick={() => { if (!d.auto) { setEditItem(d); setDivModalOpen(true); } }}>
                            <span style={{ fontSize: 9, fontWeight: 700, marginRight: 3, opacity: 0.9 }}>
                              {d.payDate === dayStr ? 'PAY' : 'EX'}
                            </span>{d.name.replace(/THB$/, '')}
                          </div>
                        ))}
                        {dayEco.map((e, ei) => {
                          const tc = ECO_TYPE_COLORS[e.type] || ECO_TYPE_COLORS.other;
                          const isCustom = !e._hardcoded && e.id;
                          return (
                            <div key={e.id || e.label + ei} title={e.label + (e.note ? ' · ' + e.note : '')}
                                 style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, marginBottom: 2,
                                   background: tc.bg + 'dd', color: tc.text,
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                   cursor: isCustom ? 'pointer' : 'default',
                                   opacity: e.importance === 'low' ? 0.7 : 1,
                                 }}
                                 onClick={() => { if (isCustom) { setEditEcoItem(e); setEcoModalOpen(true); } }}>
                              <span style={{ fontWeight: 700, marginRight: 2 }}>{tc.label}</span>{e.label.replace(new RegExp('^' + tc.label + '\\s*', 'i'), '')}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isMobile && selectedDay && (() => {
            const selDivs = sorted.filter(d => d.payDate === selectedDay || d.exDate === selectedDay);
            const selEco  = allEcoEvents.filter(e => e.date === selectedDay && showEcoTypes[e.type]);
            if (selDivs.length === 0 && selEco.length === 0) return null;
            return (
              <div className="card" style={{ marginTop: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{selectedDay}</span>
                  <button className="icon-toggle" onClick={() => setSelectedDay(null)}><Icon name="x" size={13} /></button>
                </div>
                {selDivs.map(d => {
                  const isPay = d.payDate === selectedDay;
                  const amt = effectiveAmount(d);
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3,
                        background: isPay ? 'var(--green-600)' : 'var(--fg-4)', color: '#fff', flexShrink: 0 }}>
                        {isPay ? 'PAY' : 'EX'}
                      </span>
                      <span style={{ fontWeight: 600 }}>{d.name.replace(/THB$/, '')}</span>
                      {d.note && <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 2 }}>{d.note}</span>}
                      {amt > 0 && <span style={{ color: 'var(--green-600)', marginLeft: 'auto', fontWeight: 600 }}>{sym}{window.fmtBig(amt)}</span>}
                    </div>
                  );
                })}
                {selEco.map((e, i) => {
                  const tc = ECO_TYPE_COLORS[e.type] || ECO_TYPE_COLORS.other;
                  return (
                    <div key={e.id || e.label + i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                        background: tc.bg, color: tc.text, flexShrink: 0 }}>
                        {tc.label}
                      </span>
                      <span style={{ fontWeight: 500 }}>{e.label}</span>
                      {e.note && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{e.note}</span>}
                      <span style={{ fontSize: 10, marginLeft: 'auto', fontWeight: 700,
                        color: e.importance === 'high' ? 'var(--red-600)' : e.importance === 'medium' ? '#d97706' : 'var(--fg-3)' }}>
                        {e.importance || 'low'}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {(thisMonth.length === 0 && monthEcoEvents.length === 0) && (
            <div style={{ textAlign: 'center', color: 'var(--fg-3)', padding: '24px 0', fontSize: 13 }}>
              No events scheduled this month.
            </div>
          )}
        </React.Fragment>
      )}

      {/* ── DIVIDENDS TAB ────────────────────────────────────────────────────── */}
      {tab === 'dividends' && (
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
                  <tr><td colSpan={8}><div className="empty">No dividend entries yet. Click "Add dividend" to start.</div></td></tr>
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
                          {d.auto && <span className="t-small" style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 6, background: 'var(--border-1)', color: 'var(--fg-3)', fontSize: 10 }}>auto</span>}
                        </span>
                      </td>
                      <td className="num" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{d.exDate || '—'}</td>
                      <td className="num" style={{ fontWeight: 600, fontSize: 12 }}>{d.payDate}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{d.amountPerShare ? window.fmtPrice(d.amountPerShare, d.currency) : '—'}</td>
                      <td className="num up">{amt ? sym + window.fmtBig(amt) : '—'}</td>
                      <td className="num" style={{ color: 'var(--fg-3)' }}>{d.currency}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{d.note || '—'}</td>
                      <td>
                        {d.auto ? (
                          <span className="t-small" style={{ color: 'var(--fg-3)' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="icon-toggle" onClick={() => { setEditItem(d); setDivModalOpen(true); }}><Icon name="edit-2" size={13} /></button>
                            <button className="icon-toggle" onClick={() => Store.deleteDividend(d.id)} style={{ color: 'var(--red-600)' }}><Icon name="trash-2" size={13} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ECO EVENTS TAB ───────────────────────────────────────────────────── */}
      {tab === 'events' && (
        <React.Fragment>
          {/* Type filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(ECO_TYPE_COLORS).map(([k, v]) => (
              <button key={k} onClick={() => setShowEcoTypes(s => ({ ...s, [k]: !s[k] }))}
                style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid ' + (showEcoTypes[k] ? v.bg : 'var(--border-2)'),
                  background: showEcoTypes[k] ? v.bg : 'transparent',
                  color: showEcoTypes[k] ? v.text : 'var(--fg-3)',
                }}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="card">
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th className="num">Date</th>
                    <th>Importance</th>
                    <th>Note</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {allEcoEvents
                    .filter(e => showEcoTypes[e.type])
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((e, i) => {
                      const tc = ECO_TYPE_COLORS[e.type] || ECO_TYPE_COLORS.other;
                      const isPast = e.date < new Date().toISOString().slice(0, 10);
                      const isCustom = !e._hardcoded && e.id;
                      return (
                        <tr key={e.id || e.label + i} className="pos" style={{ opacity: isPast ? 0.5 : 1 }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.text }}>
                                {tc.label}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{e.label}</span>
                            </div>
                          </td>
                          <td className="num" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{e.date}</td>
                          <td>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                              background: e.importance === 'high' ? 'rgba(220,38,38,0.12)' : e.importance === 'medium' ? 'rgba(217,119,6,0.12)' : 'var(--bg-sunken)',
                              color: e.importance === 'high' ? 'var(--red-600)' : e.importance === 'medium' ? '#d97706' : 'var(--fg-3)',
                            }}>{e.importance || 'low'}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{e.note || '—'}</td>
                          <td>
                            {isCustom ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="icon-toggle" onClick={() => { setEditEcoItem(e); setEcoModalOpen(true); }}><Icon name="edit-2" size={13} /></button>
                                <button className="icon-toggle" onClick={() => Store.deleteEcoEvent && Store.deleteEcoEvent(e.id)} style={{ color: 'var(--red-600)' }}><Icon name="trash-2" size={13} /></button>
                              </div>
                            ) : <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>built-in</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </React.Fragment>
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

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h"><div className="t">Monthly income {curYear}</div></div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="ptable">
                <thead><tr>
                  <th>Month</th><th className="num">Income</th>
                  <th className="num">Entries</th><th>Holdings</th>
                </tr></thead>
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
                <thead><tr>
                  <th>Holding</th><th className="num">Total Income</th>
                  <th className="num">Entries</th><th className="num">Share</th>
                </tr></thead>
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

      {divModalOpen && (
        <DividendModal
          item={editItem}
          onClose={() => { setDivModalOpen(false); setEditItem(null); }}
        />
      )}
      {ecoModalOpen && (
        <EcoEventModal
          item={editEcoItem}
          onClose={() => { setEcoModalOpen(false); setEditEcoItem(null); }}
        />
      )}
    </div>
  );
}
