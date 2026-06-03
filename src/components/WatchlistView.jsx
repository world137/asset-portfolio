/* eslint-disable */
/* WatchlistView.jsx — Track US stocks, ETFs, and crypto prices (DB-backed) */

// Resolve classKey + name for PriceChartModal
function resolveWlChart(item) {
  if (item.type === 'crypto') return { classKey: 'crypto',   name: item.ticker };
  return                             { classKey: 'usaStock', name: item.ticker };
}

// Resolve Yahoo Finance symbol for technical modal
function resolveWlTechSymbol(item) {
  if (item.type === 'crypto') {
    const m = window.CRYPTO_MAP && window.CRYPTO_MAP[item.ticker];
    return m ? `${m.sym}-USD` : null;
  }
  return item.ticker; // stocks/ETFs use ticker directly
}

// Check if any relevant market is currently open
function isAnyMarketOpen() {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const utcMin = h * 60 + m;

  // Thai SET (UTC+7): morning 10:00-12:30, afternoon 14:30-16:30
  // => UTC: 03:00-05:30 and 07:30-09:30
  const thaiOpen = (utcMin >= 180 && utcMin < 330) || (utcMin >= 450 && utcMin < 570);

  // US NYSE/NASDAQ 9:30-16:00 ET. EST = UTC-5, EDT = UTC-4
  // Conservative window: 13:00-21:00 UTC
  const usOpen = utcMin >= 780 && utcMin < 1260;

  return thaiOpen || usOpen;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function dbLoad() {
  try {
    const id = Store.getPortfolioId();
    const r  = await fetch('/api/watchlist?id=' + encodeURIComponent(id));
    const j  = await r.json();
    return Array.isArray(j.items) ? j.items : [];
  } catch { return []; }
}

async function dbSave(items) {
  try {
    const id = Store.getPortfolioId();
    const minimal = items.map(({ ticker, type, name }) => ({ ticker, type, name }));
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, items: minimal }),
    });
  } catch (_) {}
}

// ── Single watchlist card ─────────────────────────────────────────────────────
function WatchlistCard({ item, onRemove, onChart, onTechnical }) {
  const hasPrice = item.price != null;
  const isUp     = (item.chgPct || 0) >= 0;

  return (
    <div className="wl-card" onClick={onChart} style={{ cursor: 'pointer' }} title="Click to view chart">
      <div className="wl-card-top">
        <div>
          <div className="wl-ticker">{item.ticker}</div>
          {item.name && (
            <div className="wl-name" title={item.name}>
              {item.name.length > 24 ? item.name.slice(0, 22) + '…' : item.name}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span className={'wl-type-badge wl-type-' + item.type}>
            {item.type === 'crypto' ? 'CRYPTO' : 'STOCK/ETF'}
          </span>
          {onTechnical && (
            <button
              className="wl-remove-btn"
              style={{ color: 'var(--accent)' }}
              onClick={e => { e.stopPropagation(); onTechnical(); }}
              title="Technical analysis"
            >
              <Icon name="activity" size={13} />
            </button>
          )}
          <button
            className="wl-remove-btn"
            onClick={e => { e.stopPropagation(); onRemove(item.ticker); }}
            title="Remove"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>

      <div className="wl-price-row">
        {hasPrice ? (
          <>
            <span className="wl-price">${window.fmtBig(item.price)}</span>
            {item.chgPct != null && (
              <span className={'wl-chg ' + (isUp ? 'up' : 'down')}>
                {isUp ? '▲' : '▼'} {Math.abs(item.chgPct).toFixed(2)}%
              </span>
            )}
          </>
        ) : (
          <span className="wl-price" style={{ color: 'var(--fg-4)' }}>—</span>
        )}
      </div>

      {item.prePost && (
        <div className={'wl-prepost ' + (item.prePost.pct >= 0 ? 'up' : 'down')}>
          <span className="wl-prepost-label">{item.prePost.type === 'pre' ? 'Pre-market' : 'After-hours'}</span>
          <span className="wl-prepost-price">${window.fmtBig(item.prePost.price)}</span>
          {item.prePost.pct != null && (
            <span className="wl-prepost-pct">
              ({item.prePost.pct >= 0 ? '+' : ''}{item.prePost.pct.toFixed(2)}%)
            </span>
          )}
        </div>
      )}

      <div className="wl-card-footer">
        {item.updatedAt ? (
          <span className="wl-updated">Updated {window.timeAgo(item.updatedAt)}</span>
        ) : (
          <span className="wl-updated" style={{ color: 'var(--fg-4)' }}>Not yet fetched</span>
        )}
        <span className="wl-chart-hint">
          <Icon name="trending-up" size={12} /> chart
        </span>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
function WatchlistView() {
  const [items,     setItems]     = React.useState([]);
  const [dbLoading, setDbLoading] = React.useState(true);
  const [ticker,    setTicker]    = React.useState('');
  const [type,      setType]      = React.useState('stock');
  const [loading,   setLoading]   = React.useState(false);
  const [addErr,    setAddErr]    = React.useState('');
  const [filter,    setFilter]    = React.useState('all');
  const [chartItem, setChartItem] = React.useState(null);
  const [techSym,   setTechSym]   = React.useState(null);
  const [marketOpen, setMarketOpen] = React.useState(isAnyMarketOpen());
  const itemsRef = React.useRef(items);

  // Keep ref in sync for auto-refresh closure
  React.useEffect(() => { itemsRef.current = items; }, [items]);

  // Load from DB on mount, then immediately fetch live prices
  React.useEffect(() => {
    dbLoad().then(async loaded => {
      setItems(loaded);
      setDbLoading(false);
      if (loaded.length > 0) {
        setLoading(true);
        const withPrices = await fetchPricesFor(loaded);
        setItems(withPrices);
        setLoading(false);
      }
    });
  }, []);

  // Auto-refresh every minute when market is open
  React.useEffect(() => {
    const checkMarket = () => setMarketOpen(isAnyMarketOpen());
    const marketTimer = setInterval(checkMarket, 60000);

    let refreshTimer = null;
    if (marketOpen) {
      refreshTimer = setInterval(async () => {
        const current = itemsRef.current;
        if (!current.length) return;
        const updated = await fetchPricesFor(current);
        setItems(updated);
      }, 60000);
    }

    return () => {
      clearInterval(marketTimer);
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [marketOpen]);

  const normalTicker = ticker.trim().toUpperCase();

  async function fetchPricesFor(list) {
    if (!list.length) return list;

    const stocks  = list.filter(i => i.type === 'stock');
    const cryptos = list.filter(i => i.type === 'crypto');

    const payload = {
      yahoo:  stocks.map(i => ({ key: 'watchlist', name: i.ticker, symbol: i.ticker })),
      crypto: cryptos.map(i => {
        const m = window.CRYPTO_MAP && window.CRYPTO_MAP[i.ticker];
        return { key: 'watchlist', name: i.ticker, id: m ? m.id : i.ticker.toLowerCase() };
      }),
      fx: true,
    };

    try {
      const r    = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) return list;
      const data = await r.json();
      if (!data || !data.prices) return list;

      const usdthb = (data.fx && data.fx.USDTHB) || Store.get().fx.USDTHB || 35;
      const now    = Date.now();

      return list.map(item => {
        const k      = 'watchlist:' + item.ticker;
        const raw    = data.prices[k];
        if (raw == null) return item;

        const priceUsd  = item.type === 'crypto' ? raw / usdthb : raw;
        const prePost   = (data.prePost   && data.prePost[k])   || null;
        const prevClose = (data.prevCloses && data.prevCloses[k]) ?? null;

        // Compute day change % from prevClose
        let chgPct = null;
        if (prevClose != null && prevClose !== 0) {
          if (item.type === 'crypto') {
            // prevClose is in THB; raw is in THB → convert both to USD for % (same result)
            const prevCloseUsd = prevClose / usdthb;
            chgPct = ((priceUsd - prevCloseUsd) / prevCloseUsd) * 100;
          } else {
            chgPct = ((priceUsd - prevClose) / prevClose) * 100;
          }
        }

        return { ...item, price: priceUsd, chgPct, updatedAt: now, prePost };
      });
    } catch (_) { return list; }
  }

  async function handleAdd() {
    if (!normalTicker) return;
    if (items.find(i => i.ticker === normalTicker)) { setAddErr('Already in watchlist.'); return; }
    const newItem = { ticker: normalTicker, type, price: null, chgPct: null, name: null, updatedAt: null };
    const pending = [...items, newItem];
    setLoading(true);
    const updated = await fetchPricesFor(pending);
    setItems(updated);
    await dbSave(updated);
    setTicker('');
    setAddErr('');
    setLoading(false);
  }

  async function handleRefresh() {
    if (!items.length) return;
    setLoading(true);
    const updated = await fetchPricesFor(items);
    setItems(updated);
    setLoading(false);
  }

  async function handleRemove(tk) {
    const updated = items.filter(i => i.ticker !== tk);
    setItems(updated);
    await dbSave(updated);
  }

  const stockCount  = items.filter(i => i.type === 'stock').length;
  const cryptoCount = items.filter(i => i.type === 'crypto').length;
  const displayed   = filter === 'all' ? items : items.filter(i => i.type === filter);
  const chart       = chartItem ? resolveWlChart(chartItem) : null;

  if (dbLoading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Loading watchlist…</span>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Watchlist</h1>
          <div className="t-small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Track US stocks, ETFs &amp; crypto · {items.length} item{items.length !== 1 ? 's' : ''}
            {marketOpen
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--green-600)', fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-600)', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                  Market open · auto-refresh 1m
                </span>
              : <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>Market closed</span>
            }
          </div>
        </div>
        <Button variant="secondary" size="sm" icon="refresh-cw" onClick={handleRefresh} disabled={loading || !items.length}>
          {loading ? 'Refreshing…' : 'Refresh prices'}
        </Button>
      </div>

      {/* Add form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <div>
            <div className="t">Add to watchlist</div>
            <div className="s">US stock / ETF (AAPL, VOO…) or crypto (BTC, ETH…)</div>
          </div>
        </div>
        <div className="card-b">
          <div className="wl-add-row">
            <input
              className="wl-add-input"
              type="text"
              placeholder="e.g. AAPL, VOO, BTC"
              value={ticker}
              onChange={e => { setTicker(e.target.value.toUpperCase()); setAddErr(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              disabled={loading}
            />
            <div className="pill-toggle" style={{ flexShrink: 0 }}>
              <button className={type === 'stock' ? 'on' : ''} onClick={() => setType('stock')}>Stock / ETF</button>
              <button className={type === 'crypto' ? 'on' : ''} onClick={() => setType('crypto')}>Crypto</button>
            </div>
            <Button variant="primary" size="sm" icon="plus" onClick={handleAdd} disabled={!normalTicker || loading}>
              Add
            </Button>
          </div>
          {addErr && <div style={{ color: 'var(--red-600)', fontSize: 12, marginTop: 8 }}>{addErr}</div>}
        </div>
      </div>

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="layoutseg" style={{ marginBottom: 16 }}>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All ({items.length})</button>
          <button className={filter === 'stock' ? 'on' : ''} onClick={() => setFilter('stock')}>Stocks / ETF ({stockCount})</button>
          <button className={filter === 'crypto' ? 'on' : ''} onClick={() => setFilter('crypto')}>Crypto ({cryptoCount})</button>
        </div>
      )}

      {/* Grid or empty state */}
      {items.length === 0 ? (
        <div className="card">
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
                 strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14, opacity: 0.45 }}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nothing to watch yet</div>
            <div style={{ fontSize: 13 }}>Add a ticker above to start tracking. Click any card to see the price chart.</div>
          </div>
        </div>
      ) : (
        <div className="wl-grid">
          {displayed.map(item => {
            const techSymbol = resolveWlTechSymbol(item);
            return (
              <WatchlistCard
                key={item.ticker}
                item={item}
                onRemove={handleRemove}
                onChart={() => setChartItem(item)}
                onTechnical={techSymbol ? () => setTechSym(techSymbol) : null}
              />
            );
          })}
        </div>
      )}

      {/* Price chart modal */}
      {chart && (
        <PriceChartModal
          classKey={chart.classKey}
          name={chart.name}
          onClose={() => setChartItem(null)}
        />
      )}

      {/* Technical modal */}
      {techSym && (
        <TechnicalModal symbol={techSym} onClose={() => setTechSym(null)} />
      )}
    </div>
  );
}
