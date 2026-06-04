/* eslint-disable */
/* DataTransferModal.jsx — ZIP export and import (override / topup)
   Also accepts raw portfolio.json / wallet.json files (extracted from a ZIP).  */

// Detect whether a parsed JSON object is portfolio or wallet data.
function detectJsonType(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if ('holdings' in obj || 'sectors' in obj || 'snapshots' in obj || 'sales' in obj) return 'portfolio';
  if ('accounts' in obj || 'transactions' in obj || 'debts' in obj) return 'wallet';
  return null;
}

function DataTransferModal({ open, onClose }) {
  const [tab,      setTab]      = React.useState('export');
  const [mode,     setMode]     = React.useState('topup');
  const [busy,     setBusy]     = React.useState(false);
  const [result,   setResult]   = React.useState(null); // { ok, msg }

  // Detected import source — set after file(s) are chosen.
  // { kind: 'zip', file: File }
  // { kind: 'json', portfolio: obj|null, wallet: obj|null, names: string[] }
  const [source, setSource] = React.useState(null);

  const fileRef = React.useRef();

  React.useEffect(() => {
    if (!open) {
      setTab('export'); setMode('topup');
      setSource(null); setBusy(false); setResult(null);
    }
  }, [open]);

  if (!open) return null;

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setBusy(true); setResult(null);
    try {
      const data = await Store.exportData();
      const zip  = new JSZip();
      zip.file('portfolio.json', JSON.stringify(data.portfolio, null, 2));
      zip.file('wallet.json',   JSON.stringify(data.wallet,    null, 2));
      zip.file('meta.json', JSON.stringify({
        exportedAt: data.exportedAt,
        version:    data.version,
        userId:     Store.getPortfolioId(),
      }, null, 2));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setResult({ ok: true, msg: 'Backup downloaded successfully.' });
    } catch (e) {
      setResult({ ok: false, msg: 'Export failed: ' + e.message });
    }
    setBusy(false);
  };

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    setResult(null);
    if (!picked.length) return;

    // Single ZIP
    if (picked.length === 1 && picked[0].name.endsWith('.zip')) {
      setSource({ kind: 'zip', file: picked[0] });
      return;
    }

    // One or more JSON files
    const jsonFiles = picked.filter(f => f.name.endsWith('.json'));
    if (!jsonFiles.length) {
      setResult({ ok: false, msg: 'Please select a .zip backup or one/both of portfolio.json and wallet.json.' });
      return;
    }

    let portfolio = null, wallet = null;
    const names = [];

    for (const f of jsonFiles) {
      try {
        const text = await f.text();
        const obj  = JSON.parse(text);
        const type = detectJsonType(obj);
        if (type === 'portfolio') { portfolio = obj; names.push('portfolio.json'); }
        else if (type === 'wallet') { wallet = obj; names.push('wallet.json'); }
        else names.push(`${f.name} (unrecognised)`);
      } catch (_) {
        names.push(`${f.name} (parse error)`);
      }
    }

    if (!portfolio && !wallet) {
      setResult({ ok: false, msg: 'Could not detect portfolio.json or wallet.json content in the selected files.' });
      return;
    }

    setSource({ kind: 'json', portfolio, wallet, names });
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!source) return;
    setBusy(true); setResult(null);
    try {
      let portfolio = null, wallet = null;

      if (source.kind === 'zip') {
        const zip           = await JSZip.loadAsync(source.file);
        const portfolioFile = zip.file('portfolio.json');
        const walletFile    = zip.file('wallet.json');
        if (!portfolioFile && !walletFile) throw new Error('ZIP must contain portfolio.json or wallet.json');
        portfolio = portfolioFile ? JSON.parse(await portfolioFile.async('string')) : null;
        wallet    = walletFile    ? JSON.parse(await walletFile.async('string'))    : null;
      } else {
        portfolio = source.portfolio;
        wallet    = source.wallet;
      }

      await Store.importData({ portfolio, wallet, mode });
      const modeLabel = mode === 'override' ? 'All data replaced.' : 'New items merged in.';
      setResult({ ok: true, msg: `Import successful. ${modeLabel}` });
    } catch (e) {
      setResult({ ok: false, msg: 'Import failed: ' + e.message });
    }
    setBusy(false);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const switchTab = (t) => { setTab(t); setResult(null); };

  function sourceLabel() {
    if (!source) return null;
    if (source.kind === 'zip') return source.file.name;
    return source.names.join(' + ');
  }

  function sourceSummary() {
    if (!source) return null;
    if (source.kind === 'zip') return 'ZIP archive';
    const parts = [];
    if (source.portfolio) {
      const h = Object.values(source.portfolio.holdings || {}).reduce((s, a) => s + a.length, 0);
      parts.push(`portfolio: ${h} holdings`);
    }
    if (source.wallet) {
      parts.push(`wallet: ${(source.wallet.accounts || []).length} accounts`);
    }
    return parts.join(' · ');
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="mh">
          <div>
            <div className="t">Backup &amp; Restore</div>
            <div className="s">Export or import all portfolio and wallet data</div>
          </div>
          <button className="x" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div className="mb">
          {/* Tab switcher */}
          <div className="pill-toggle" style={{ marginBottom: 20 }}>
            <button className={tab === 'export' ? 'on' : ''} onClick={() => switchTab('export')}>Export ZIP</button>
            <button className={tab === 'import' ? 'on' : ''} onClick={() => switchTab('import')}>Import</button>
          </div>

          {/* ── Export tab ── */}
          {tab === 'export' && (
            <div>
              <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 14px', lineHeight: 1.55 }}>
                Downloads a <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4 }}>.zip</code> file
                with all your data. Keep it somewhere safe — do <b>not</b> extract it, as you can import the ZIP directly.
              </p>
              <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.6 }}>
                <b style={{ color: 'var(--fg-2)' }}>Includes:</b>{' '}
                Holdings · Sectors · Snapshots · Sell log · Settings · FX rates
                · Wallet accounts · Transactions · Debts
              </div>
              <Button variant="primary" icon="download" onClick={handleExport} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
                {busy ? 'Preparing ZIP…' : 'Download Backup ZIP'}
              </Button>
            </div>
          )}

          {/* ── Import tab ── */}
          {tab === 'import' && (
            <div>
              <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.55 }}>
                Upload a <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4 }}>.zip</code> backup,
                or select <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4 }}>portfolio.json</code>{' '}
                and/or <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4 }}>wallet.json</code> directly
                from an extracted folder.
              </p>

              {/* Mode selector */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Import mode</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Top up */}
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    padding: '10px 12px', borderRadius: 9,
                    border: `1.5px solid ${mode === 'topup' ? 'var(--accent)' : 'var(--border-2)'}`,
                    background: mode === 'topup' ? 'var(--accent-bg,rgba(94,92,230,0.07))' : 'transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                    <input type="radio" name="dt-mode" value="topup"
                           checked={mode === 'topup'} onChange={() => setMode('topup')}
                           style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Top up / Merge</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                        Add new items from the backup. Existing data is kept unchanged.
                      </div>
                    </div>
                  </label>

                  {/* Override */}
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    padding: '10px 12px', borderRadius: 9,
                    border: `1.5px solid ${mode === 'override' ? 'var(--red-400,#f87171)' : 'var(--border-2)'}`,
                    background: mode === 'override' ? 'rgba(239,68,68,0.06)' : 'transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                    <input type="radio" name="dt-mode" value="override"
                           checked={mode === 'override'} onChange={() => setMode('override')}
                           style={{ marginTop: 3, accentColor: 'var(--red-500,#ef4444)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: mode === 'override' ? 'var(--red-600,#dc2626)' : undefined }}>
                        Override all
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                        <span style={{ color: 'var(--red-500,#ef4444)', fontWeight: 600 }}>Deletes everything</span>{' '}
                        and replaces with backup data. Cannot be undone.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* File picker */}
              <input ref={fileRef} type="file"
                     accept=".zip,.json,application/zip,application/json"
                     multiple
                     onChange={handleFileChange}
                     style={{ display: 'none' }} />

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: source ? 10 : 14 }}>
                <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy}>
                  Choose file(s)
                </Button>
                {source
                  ? <span style={{ fontSize: 13, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {sourceLabel()}
                    </span>
                  : <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>No file selected</span>}
              </div>

              {/* Detected content summary */}
              {source && (
                <div style={{
                  marginBottom: 14, padding: '7px 12px', borderRadius: 8, fontSize: 12,
                  background: 'var(--bg-2)', color: 'var(--fg-3)', lineHeight: 1.5,
                }}>
                  {sourceSummary()}
                </div>
              )}

              <Button
                variant={mode === 'override' ? 'danger' : 'primary'}
                icon="upload"
                onClick={handleImport}
                disabled={!source || busy}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {busy ? 'Importing…' : mode === 'override' ? 'Override & Import' : 'Merge & Import'}
              </Button>
            </div>
          )}

          {/* Status message */}
          {result && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 9, fontSize: 13, lineHeight: 1.45,
              background: result.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              color:      result.ok ? 'var(--green-700,#15803d)'  : 'var(--red-700,#b91c1c)',
              border:     `1px solid ${result.ok ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
            }}>
              {result.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
