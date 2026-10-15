/* eslint-disable */
/* ScannerView.jsx — Pullback scanner. The page drives /api/scanner in slices, ranks the
   combined results per index, and keeps the last scan in localStorage. */

const RATING_COLOR = {
  EXCELLENT:  'var(--green-600)',
  STRONG:     'var(--green-600)',
  WATCHLIST:  'var(--accent)',
};

const INDEX_LABEL = {
  SP500:     { text: 'S&P 500', color: 'var(--accent)' },
  NASDAQ100: { text: 'NASDAQ',  color: 'var(--green-600)' },
  SET50:     { text: 'SET50',   color: 'var(--red-600)' },
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
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
          {(c.indexes || []).map(ix => (
            <span key={ix} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
              color: INDEX_LABEL[ix]?.color || 'var(--fg-2)', background: 'var(--bg-2, rgba(128,128,128,.12))' }}>
              {INDEX_LABEL[ix]?.text || ix}
            </span>
          ))}
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

const SCAN_BATCH = 80;
const SCAN_CACHE_KEY = 'scanner:latest';
const RANKING = { minScore: 65, topN: 10 };

// Rank each index on its own (so a big index can't crowd out a small one), then merge.
function rankCandidates(all) {
  const strength = { POC_SUPPORT: 3, VAL_SUPPORT: 2, HIGH_VOLUME_NODE: 1 };
  const cmp = (a, b) =>
    b.score - a.score ||
    (strength[b.volume_profile.signal] || 0) - (strength[a.volume_profile.signal] || 0) ||
    b.rsi - a.rsi ||
    a.ema_distance_percent - b.ema_distance_percent;
  const seen = new Set();
  const out = [];
  for (const idx of ['SP500', 'NASDAQ100', 'SET50']) {
    all.filter(c => c.indexes.includes(idx) && c.score >= RANKING.minScore)
      .sort(cmp).slice(0, RANKING.topN)
      .forEach(c => { if (!seen.has(c.symbol)) { seen.add(c.symbol); out.push(c); } });
  }
  return out;
}

function ScannerView() {
  const [running,  setRunning]  = React.useState(false);
  const [progress, setProgress] = React.useState(null); // { done, total }
  const [result,   setResult]   = React.useState(null);
  const [error,    setError]    = React.useState(null);

  // Show the last scan from this browser (scans are never started automatically)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SCAN_CACHE_KEY);
      if (raw) setResult(JSON.parse(raw));
    } catch (_) {}
  }, []);

  async function runScan() {
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const all = [];
      let skipped = 0, latest = null, offset = 0, total = 0;
      while (offset != null) {
        const r = await fetch('/api/scanner', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, limit: SCAN_BATCH }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.message || j.error || 'Scan failed');
        all.push(...j.candidates);
        skipped += Object.keys(j.skipped || {}).length;
        if (j.marketDataTimestamp && (!latest || j.marketDataTimestamp > latest)) latest = j.marketDataTimestamp;
        total = j.total;
        offset = j.next;
        setProgress({ done: offset == null ? total : offset, total });
      }
      const res = {
        scan_time: new Date().toISOString(),
        market_data_timestamp: latest,
        universe_size: total,
        skipped_count: skipped,
        candidates: rankCandidates(all),
      };
      setResult(res);
      try { localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(res)); } catch (_) {}
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  // Highest score first (ties: higher RSI)
  const candidates = [...((result && result.candidates) || [])].sort((a, b) => b.score - a.score || b.rsi - a.rsi);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Stock Scanner</h1>
          <div className="t-small">
            Pullback / EMA / RSI / Volume Profile screen over SP500 + NASDAQ100 + SET50{result && result.scan_time ? ` · scanned ${window.timeAgo ? window.timeAgo(Date.parse(result.scan_time)) : result.scan_time}` : ''}
          </div>
        </div>
        <Button variant="primary" size="sm" icon="refresh-cw" onClick={runScan} disabled={running}>
          {running ? 'Scanning…' : (result ? 'Rescan' : 'Run scan')}
        </Button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--red-100)' }}>
          <div className="card-b">
            <div style={{ color: 'var(--red-600)', fontWeight: 600, marginBottom: 4 }}>{error}</div>
          </div>
        </div>
      )}

      {!result && !error && !running && (
        <div className="card">
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
            <Icon name="activity" size={36} />
            <div style={{ fontSize: 15, fontWeight: 600, margin: '14px 0 6px' }}>No scan yet</div>
            <div style={{ fontSize: 13 }}>Click "Run scan" to screen SP500 + NASDAQ100 + SET50 (takes under a minute).</div>
          </div>
        </div>
      )}

      {running && (
        <div className="card">
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
            Scanning… {progress && progress.total ? `${progress.done} / ${progress.total} symbols` : ''}
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
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
              <table className="ptable" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Index</th>
                    <th className="num">Price</th>
                    <th className="num">Pullback</th>
                    <th>EMA touch</th>
                    <th className="num">RSI</th>
                    <th>VP signal</th>
                    <th className="num">Score ↓</th>
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
