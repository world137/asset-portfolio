/* eslint-disable */
/* ScannerView.jsx — Show stock-scanner candidates. Production: latest scan from the
   hosted scanner service (via /api/scanner). Local dev: can also trigger run-scan.sh --all. */

const RATING_COLOR = {
  EXCELLENT:  'var(--green-600)',
  STRONG:     'var(--green-600)',
  WATCHLIST:  'var(--accent)',
};

function ScannerRow({ c }) {
  return (
    <tr className="pos">
      <td>
        <div className="tk">
          <span>{c.symbol}</span>
        </div>
        <div className="s" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          {c.company_name}{c.sector ? ` · ${c.sector}` : ''}
        </div>
      </td>
      <td className="num">${window.fmtBig ? window.fmtBig(c.price) : c.price.toFixed(2)}</td>
      <td className="num">{c.pullback_percent.toFixed(1)}%</td>
      <td>{(c.ema_touch || []).join(', ')}</td>
      <td className="num">{c.rsi.toFixed(1)} <span style={{ color: 'var(--fg-4)' }}>({c.rsi_trend})</span></td>
      <td>{c.volume_profile ? c.volume_profile.signal : '—'}</td>
      <td className="num" style={{ fontWeight: 700 }}>{c.score}</td>
      <td>
        <span style={{ color: RATING_COLOR[c.rating] || 'var(--fg-2)', fontWeight: 600, fontSize: 12 }}>
          {c.rating}
        </span>
      </td>
    </tr>
  );
}

function ScannerView() {
  const [running, setRunning] = React.useState(false);
  const [result,  setResult]  = React.useState(null);
  const [error,   setError]   = React.useState(null);
  const [log,     setLog]     = React.useState(null);
  const [mode,    setMode]    = React.useState(null); // 'published' | 'local' | 'unavailable'
  const [publishedAt, setPublishedAt] = React.useState(null);

  // Load whatever the latest scan is (never triggers a scan)
  React.useEffect(() => {
    let dead = false;
    fetch('/api/scanner').then(r => r.json()).then(j => {
      if (dead) return;
      setMode(j.mode || null);
      if (j.ok) { setResult(j.result); setPublishedAt(j.publishedAt || null); }
      else if (j.message && j.error !== 'no-results') setError(j.message);
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  async function runScan() {
    setRunning(true);
    setError(null);
    try {
      // Local dev can run the scan itself; elsewhere just reload the latest published scan
      const r = mode === 'local'
        ? await fetch('/api/scanner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
        : await fetch('/api/scanner');
      const j = await r.json();
      if (j.mode) setMode(j.mode);
      if (j.publishedAt) setPublishedAt(j.publishedAt);
      if (!j.ok) {
        setError(j.message || j.error || 'Scan failed');
        setLog(j.log || null);
      } else {
        setResult(j.result);
        setLog(j.log || null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const candidates = (result && result.candidates) || [];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Stock Scanner</h1>
          <div className="t-small">
            Pullback / EMA / RSI / Volume Profile screen over SP500 + NASDAQ100 + SET50{mode === 'published' && publishedAt ? ` · last published ${window.timeAgo ? window.timeAgo(Date.parse(publishedAt)) : publishedAt}` : ''}
          </div>
        </div>
        <Button variant="primary" size="sm" icon="refresh-cw" onClick={runScan} disabled={running || mode === 'unavailable'}>
          {running ? (mode === 'published' ? 'Loading…' : 'Scanning…') : (mode === 'published' ? 'Refresh results' : 'Run scan (--all)')}
        </Button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--red-100)' }}>
          <div className="card-b">
            <div style={{ color: 'var(--red-600)', fontWeight: 600, marginBottom: 4 }}>{error}</div>
            {log && <pre style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'pre-wrap', margin: 0 }}>{log}</pre>}
          </div>
        </div>
      )}

      {!result && !error && !running && (
        <div className="card">
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
            <Icon name="activity" size={36} />
            <div style={{ fontSize: 15, fontWeight: 600, margin: '14px 0 6px' }}>No scan yet</div>
            <div style={{ fontSize: 13 }}>{mode === 'published' ? 'No scan published yet — run stock-scanner/scripts/publish-scan.sh, then click "Refresh results".' : 'Click "Run scan (--all)" to build and run stock-scanner.'}</div>
          </div>
        </div>
      )}

      {running && (
        <div className="card">
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
            {mode === 'published' ? 'Loading latest scan…' : 'Scanning sp500 + nasdaq100 + set50… this can take a few minutes.'}
          </div>
        </div>
      )}

      {result && (
        <React.Fragment>
          <div className="t-small" style={{ marginBottom: 10 }}>
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} ·
            data as of {window.timeAgo ? window.timeAgo(Date.parse(result.market_data_timestamp)) : result.market_data_timestamp}
          </div>
          {candidates.length === 0 ? (
            <div className="card">
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
                No high-quality setups found today.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="num">Price</th>
                    <th className="num">Pullback</th>
                    <th>EMA touch</th>
                    <th className="num">RSI</th>
                    <th>VP signal</th>
                    <th className="num">Score</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(c => <ScannerRow key={c.symbol} c={c} />)}
                </tbody>
              </table>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
