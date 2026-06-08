/* eslint-disable */
/* CSVImportView.jsx — Import bank statement CSV (Thai banks + generic) */

const CSV_PRESETS = {
  generic: { label: 'Generic (date,amount,description)', dateCol: 0, amountCol: 1, descCol: 2, skipRows: 1, dateFormat: 'yyyy-mm-dd', positiveIsIncome: true },
  kasikorn: { label: 'Kasikorn Bank (KBank)', dateCol: 0, amountCol: 3, descCol: 5, skipRows: 4, dateFormat: 'dd/mm/yyyy', positiveIsIncome: true },
  scb: { label: 'SCB (Siam Commercial Bank)', dateCol: 0, amountCol: 2, descCol: 4, skipRows: 2, dateFormat: 'dd/mm/yyyy', positiveIsIncome: true },
  bbl: { label: 'Bangkok Bank (BBL)', dateCol: 0, amountCol: 2, descCol: 3, skipRows: 3, dateFormat: 'dd/mm/yyyy', positiveIsIncome: true },
  krungthai: { label: 'Krungthai Bank (KTB)', dateCol: 0, amountCol: 2, descCol: 3, skipRows: 2, dateFormat: 'dd/mm/yyyy', positiveIsIncome: true },
};

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseDate(str, fmt) {
  if (!str) return null;
  str = str.trim().replace(/\s+.*$/, ''); // strip time component
  try {
    if (fmt === 'dd/mm/yyyy') {
      const [d, m, y] = str.split(/[\/\-]/);
      if (!d || !m || !y) return null;
      return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (fmt === 'mm/dd/yyyy') {
      const [m, d, y] = str.split(/[\/\-]/);
      if (!d || !m || !y) return null;
      return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // yyyy-mm-dd or ISO
    const parts = str.split(/[\/\-T]/);
    if (parts.length >= 3) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } catch {}
  return null;
}

function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[,\s฿$£€¥]/g, '').replace(/\(([^)]+)\)/, '-$1');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function CSVImportView() {
  useStore();
  const wallet   = Store.getWallet();
  const settings = Store.settings();
  const accounts = (wallet.accounts || []).filter(a => !a.archived);
  const cats     = wallet.categories || [];

  const [preset,      setPreset]      = React.useState('generic');
  const [accountId,   setAccountId]   = React.useState(accounts[0]?.id || '');
  const [rawText,     setRawText]     = React.useState('');
  const [parsed,      setParsed]      = React.useState([]);       // { date, amount, desc, flow, keep, categoryId, dupKey }
  const [importing,   setImporting]   = React.useState(false);
  const [done,        setDone]        = React.useState(false);
  const [customCols,  setCustomCols]  = React.useState({ dateCol: 0, amountCol: 1, descCol: 2, skipRows: 1, dateFormat: 'yyyy-mm-dd' });

  const cfg = preset === 'custom' ? customCols : CSV_PRESETS[preset];

  const account = accounts.find(a => a.id === accountId);

  // Existing transactions for dedup
  const existingKeys = React.useMemo(() => {
    const set = new Set();
    for (const t of wallet.transactions || []) {
      set.add(`${t.date}|${t.amount}`);
    }
    return set;
  }, [wallet.transactions]);

  const parseFile = () => {
    if (!rawText.trim()) return;
    const lines = rawText.split('\n').slice(cfg.skipRows);
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols   = parseCSVLine(line);
      const date   = parseDate(cols[cfg.dateCol], cfg.dateFormat);
      const amount = parseAmount(cols[cfg.amountCol]);
      const desc   = (cols[cfg.descCol] || '').trim();
      if (!date || amount == null || amount === 0) continue;
      const absAmt = Math.abs(amount);
      const flow   = (cfg.positiveIsIncome ? amount > 0 : amount < 0) ? 'income' : 'expense';
      const dupKey = `${date}|${absAmt}`;
      rows.push({ date, amount: absAmt, desc, flow, keep: !existingKeys.has(dupKey), categoryId: '', dupKey, id: Math.random().toString(36).slice(2) });
    }
    setParsed(rows);
    setDone(false);
  };

  const toggleKeep = (id) => {
    setParsed(rs => rs.map(r => r.id === id ? { ...r, keep: !r.keep } : r));
  };

  const setCat = (id, catId) => {
    setParsed(rs => rs.map(r => r.id === id ? { ...r, categoryId: catId } : r));
  };

  const setFlow = (id, flow) => {
    setParsed(rs => rs.map(r => r.id === id ? { ...r, flow } : r));
  };

  const importAll = () => {
    if (!accountId) return;
    setImporting(true);
    const toImport = parsed.filter(r => r.keep);
    for (const r of toImport) {
      Store.addTransaction({
        accountId,
        date:       r.date,
        amount:     r.amount,
        flow:       r.flow,
        categoryId: r.categoryId || null,
        note:       r.desc,
        tags:       [],
      });
    }
    setImporting(false);
    setDone(true);
    setParsed([]);
    setRawText('');
  };

  const toImportCount  = parsed.filter(r => r.keep).length;
  const dupCount       = parsed.filter(r => !r.keep).length;
  const expenseCats    = cats.filter(c => c.flow === 'expense');
  const incomeCats     = cats.filter(c => c.flow === 'income');

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="t-h1" style={{ margin: '0 0 2px' }}>CSV Import</h1>
        <div className="t-small">Import transactions from your bank statement CSV export</div>
      </div>

      {done && (
        <div style={{ background: 'var(--green-600)18', border: '1.5px solid var(--green-600)44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--green-600)', fontWeight: 600, fontSize: 14 }}>
          ✓ Import complete! Transactions have been added to your wallet.
        </div>
      )}

      {/* Step 1: config */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><div className="t">Step 1 — Configure</div></div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          <div>
            <label className="flabel">Bank / Format</label>
            <select className="input" value={preset} onChange={e => setPreset(e.target.value)}>
              {Object.entries(CSV_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              <option value="custom">Custom columns…</option>
            </select>
          </div>
          <div>
            <label className="flabel">Target Account</label>
            <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">— Select —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </div>
          {preset === 'custom' && (
            <React.Fragment>
              <div>
                <label className="flabel">Date column (0-based)</label>
                <input className="input" type="number" min="0" value={customCols.dateCol}
                       onChange={e => setCustomCols(s => ({ ...s, dateCol: +e.target.value }))} />
              </div>
              <div>
                <label className="flabel">Amount column</label>
                <input className="input" type="number" min="0" value={customCols.amountCol}
                       onChange={e => setCustomCols(s => ({ ...s, amountCol: +e.target.value }))} />
              </div>
              <div>
                <label className="flabel">Description column</label>
                <input className="input" type="number" min="0" value={customCols.descCol}
                       onChange={e => setCustomCols(s => ({ ...s, descCol: +e.target.value }))} />
              </div>
              <div>
                <label className="flabel">Skip header rows</label>
                <input className="input" type="number" min="0" value={customCols.skipRows}
                       onChange={e => setCustomCols(s => ({ ...s, skipRows: +e.target.value }))} />
              </div>
              <div>
                <label className="flabel">Date format</label>
                <select className="input" value={customCols.dateFormat} onChange={e => setCustomCols(s => ({ ...s, dateFormat: e.target.value }))}>
                  <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                  <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                </select>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>

      {/* Step 2: paste CSV */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><div className="t">Step 2 — Paste CSV</div><div className="s">Copy from your bank export and paste below</div></div>
        <div style={{ padding: '0 20px 20px' }}>
          <textarea className="input" rows={8}
                    style={{ marginTop: 10, padding: 10, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical', width: '100%' }}
                    placeholder={'Paste CSV content here…\nExample:\n"Date","Amount","Description"\n"2026-01-15","500.00","Supermarket"'}
                    value={rawText}
                    onChange={e => { setRawText(e.target.value); setParsed([]); setDone(false); }} />
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <Button variant="accent" icon="upload" onClick={parseFile} disabled={!rawText.trim() || !accountId}>
              Parse CSV
            </Button>
            {rawText && (
              <Button variant="ghost" onClick={() => { setRawText(''); setParsed([]); }}>Clear</Button>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: review & import */}
      {parsed.length > 0 && (
        <div className="card">
          <div className="card-h">
            <div>
              <div className="t">Step 3 — Review & Import</div>
              <div className="s">
                {toImportCount} to import · {dupCount} likely duplicate{dupCount !== 1 ? 's' : ''} (unchecked)
              </div>
            </div>
            <Button variant="accent" icon="check" disabled={toImportCount === 0 || importing}
                    onClick={importAll}>
              Import {toImportCount} Transaction{toImportCount !== 1 ? 's' : ''}
            </Button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable">
              <thead><tr>
                <th style={{ width: 36 }}>✓</th>
                <th style={{ width: 90 }}>Date</th>
                <th>Description</th>
                <th style={{ width: 80 }}>Type</th>
                <th>Category</th>
                <th className="num" style={{ width: 110 }}>Amount</th>
              </tr></thead>
              <tbody>
                {parsed.map(r => (
                  <tr key={r.id} style={{ opacity: r.keep ? 1 : 0.45 }}>
                    <td>
                      <div onClick={() => toggleKeep(r.id)} style={{ width: 20, height: 20, borderRadius: 5,
                                 border: '2px solid ' + (r.keep ? 'var(--accent)' : 'var(--border-2)'),
                                 background: r.keep ? 'var(--accent)' : 'transparent',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', cursor: 'pointer' }}>
                        {r.keep && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{r.date}</td>
                    <td style={{ fontSize: 13 }}>
                      {r.desc || <span style={{ color: 'var(--fg-4)' }}>—</span>}
                      {existingKeys.has(r.dupKey) && <span style={{ marginLeft: 6, fontSize: 10, background: '#f59e0b22', color: '#d97706', borderRadius: 4, padding: '1px 5px' }}>Possible dup</span>}
                    </td>
                    <td>
                      <select className="input" style={{ fontSize: 11, height: 28, padding: '0 6px' }}
                              value={r.flow}
                              onChange={e => setFlow(r.id, e.target.value)}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </td>
                    <td>
                      <select className="input" style={{ fontSize: 11, height: 28, padding: '0 6px' }}
                              value={r.categoryId}
                              onChange={e => setCat(r.id, e.target.value)}>
                        <option value="">— Category —</option>
                        {(r.flow === 'expense' ? expenseCats : incomeCats).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className={'num ' + (r.flow === 'income' ? 'up' : 'down')} style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {r.flow === 'income' ? '+' : '−'}{window.fmtCcy(r.amount, account ? account.currency : 'THB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
