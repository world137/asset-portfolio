/* eslint-disable */
/* AlertsView.jsx — Feature #11: Price Alerts management UI */

// Types available for non-holding alerts (must match REPORT_CLASSES keys in telegram.js)
const NON_HOLDING_TYPES = [
  { classKey: 'thaiStock', label: 'Thai Stock', hint: 'e.g. SCB (auto adds .BK)', yahooSuffix: '.BK', ccy: 'THB' },
  { classKey: 'usaStock',  label: 'USA Stock',  hint: 'e.g. AAPL',               ccy: 'USD' },
  { classKey: 'etf',       label: 'ETF',        hint: 'e.g. QQQM',               ccy: 'USD' },
];

function PriceAlertModal({ alert, onClose }) {
  const isEdit = !!alert;
  const allPos = [];
  for (const cls of window.ASSET_CLASSES) {
    for (const p of Store.positions(cls.key)) {
      allPos.push({ label: `${cls.short} · ${p.name}`, classKey: cls.key, name: p.name, ccy: cls.ccy, cur: p.cur });
    }
  }

  const [classKey,   setClassKey]   = React.useState(alert ? alert.classKey : '');
  const [name,       setName]       = React.useState(alert ? alert.name : '');
  const [condition,  setCondition]  = React.useState(alert ? alert.condition : 'above');
  const [price,      setPrice]      = React.useState(alert ? String(alert.price) : '');
  const [note,       setNote]       = React.useState(alert ? (alert.note || '') : '');
  const [ticker,     setTicker]     = React.useState(''); // raw input for non-holding ticker
  const [nonHoldingType, setNonHoldingType] = React.useState(
    alert && !allPos.find(p => p.classKey === alert.classKey && p.name === alert.name)
      ? (alert.classKey || 'thaiStock')
      : ''
  );

  const selectedPos = allPos.find(p => p.classKey === classKey && p.name === name);
  // isNonHolding is true when user typed a ticker not matching any holding
  const isNonHolding = nonHoldingType !== '';

  function handleSelectPos(val) {
    const p = allPos.find(p => p.label === val);
    if (p) {
      // Matched a real holding — clear non-holding mode
      setClassKey(p.classKey);
      setName(p.name);
      setNonHoldingType('');
      setTicker('');
    } else {
      // Free-text — enter non-holding mode, keep ticker as the raw name
      setTicker(val);
      setName(val.trim());
      setClassKey('');
      // Default to thaiStock type when they start typing
      if (!nonHoldingType) setNonHoldingType('thaiStock');
    }
  }

  function handleTypeSelect(ck) {
    setNonHoldingType(ck);
    setClassKey(ck);
  }

  function save() {
    if (!name || !price) return;
    let finalName = name;
    let finalClassKey = classKey;
    if (isNonHolding) {
      finalClassKey = nonHoldingType;
      // For Thai stocks, ensure .BK suffix for Yahoo Finance lookup in telegram
      if (nonHoldingType === 'thaiStock' && !finalName.toUpperCase().endsWith('.BK')) {
        finalName = finalName.toUpperCase() + '.BK';
      } else {
        finalName = finalName.toUpperCase();
      }
    }
    const data = { classKey: finalClassKey, name: finalName, condition, price, note };
    if (isEdit) {
      Store.deletePriceAlert(alert.id);
      Store.addPriceAlert(data);
    } else {
      Store.addPriceAlert(data);
    }
    onClose();
  }

  const selectedType = NON_HOLDING_TYPES.find(t => t.classKey === nonHoldingType);
  const canSave = isNonHolding ? (name.trim() && price && nonHoldingType) : (name && price);

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit alert' : 'Add price alert'} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="form-label">Holding or asset ticker</label>
          <input list="alert-pos-list" placeholder="Search holding or type any ticker…"
                 value={isNonHolding ? ticker : (name ? (allPos.find(p => p.classKey === classKey && p.name === name) || {}).label || name : '')}
                 onChange={e => handleSelectPos(e.target.value)} />
          <datalist id="alert-pos-list">
            {allPos.map(p => <option key={p.classKey + ':' + p.name} value={p.label} />)}
          </datalist>
          {selectedPos && !isNonHolding && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
              Current price: {window.fmtPrice(selectedPos.cur, selectedPos.ccy)}
            </div>
          )}
        </div>

        {/* Type selector — only shown for non-holding tickers */}
        {isNonHolding && (
          <div>
            <label className="form-label">Asset type <span style={{ color: 'var(--red-600)' }}>*</span></label>
            <div style={{ display: 'flex', gap: 6 }}>
              {NON_HOLDING_TYPES.map(t => (
                <button key={t.classKey} type="button" onClick={() => handleTypeSelect(t.classKey)}
                        style={{
                          flex: 1, padding: '7px 4px', borderRadius: 6, border: '2px solid',
                          borderColor: nonHoldingType === t.classKey ? 'var(--accent)' : 'var(--border-1)',
                          background: nonHoldingType === t.classKey ? 'var(--accent-bg, rgba(59,130,246,0.1))' : 'transparent',
                          color: nonHoldingType === t.classKey ? 'var(--accent)' : 'var(--fg-2)',
                          cursor: 'pointer', fontSize: 12, fontWeight: nonHoldingType === t.classKey ? 700 : 400,
                        }}>
                  {t.label}
                </button>
              ))}
            </div>
            {selectedType && (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                {selectedType.hint} · price in {selectedType.ccy}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="form-label">Condition</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['above', '▲ Price rises above'], ['below', '▼ Price falls below']].map(([k, l]) => (
              <button key={k} onClick={() => setCondition(k)}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: '2px solid',
                               borderColor: condition === k ? 'var(--accent)' : 'var(--border-1)',
                               background: condition === k ? 'var(--accent-bg, rgba(59,130,246,0.1))' : 'transparent',
                               color: condition === k ? 'var(--accent)' : 'var(--fg-2)',
                               cursor: 'pointer', fontSize: 12, fontWeight: condition === k ? 700 : 400 }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Target price *</label>
          <input type="number" min="0" step="any" value={price} onChange={e => setPrice(e.target.value)}
                 placeholder="0.00" autoFocus />
        </div>

        <div>
          <label className="form-label">Note</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
                 placeholder="e.g. Support level, take profit…" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={!canSave}>{isEdit ? 'Save' : 'Add alert'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function AlertsView() {
  const store   = useStore();
  const alerts  = Store.getPriceAlerts();

  const [modalOpen,    setModalOpen]    = React.useState(false);
  const [editAlert,    setEditAlert]    = React.useState(null);
  const [nhPrices,     setNhPrices]     = React.useState({}); // { "classKey:name": price }
  const [nhLoading,    setNhLoading]    = React.useState(false);

  const active    = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered);

  function getPosition(classKey, name) {
    return Store.positions(classKey).find(p => p.name === name);
  }

  // Fetch live prices for non-holding alerts (no position in store)
  React.useEffect(() => {
    const nonHolding = alerts.filter(a => {
      if (a.triggered) return false;
      if (!a.classKey) return false;
      const pos = Store.positions(a.classKey).find(p => p.name === a.name);
      return !pos;
    });
    if (!nonHolding.length) return;
    setNhLoading(true);
    fetchNonHoldingPrices(nonHolding)
      .then(prices => setNhPrices(prev => ({ ...prev, ...prices })))
      .catch(() => {})
      .finally(() => setNhLoading(false));
  }, [alerts.map(a => a.id + a.triggered).join(',')]);


  function AlertRow({ a }) {
    const cls        = a.classKey ? window.ASSET_CLASSES.find(c => c.key === a.classKey) : null;
    const pos        = a.classKey ? getPosition(a.classKey, a.name) : null;
    // Use live position price, or fall back to fetched non-holding price
    const cur        = pos ? pos.cur : (nhPrices[`${a.classKey}:${a.name}`] ?? null);
    const distPct    = cur != null && a.price ? ((a.price - cur) / cur) * 100 : null;
    const hitNow     = cur !== null && (a.condition === 'above' ? cur >= a.price : cur <= a.price);
    // For non-holding alerts, fall back to NON_HOLDING_TYPES for badge label/color
    const nhType     = !cls ? NON_HOLDING_TYPES.find(t => t.classKey === a.classKey) : null;
    const badgeLabel = cls ? cls.short : (nhType ? nhType.label.replace(' Stock', '').replace('Thai', 'TH').replace('USA', 'US') : '?');
    const badgeBg    = cls ? window.CLASS_COLORS[cls.key] : (nhType ? '#6b7280' : '#888');
    const displayName = a.name.replace(/\.BK$/i, '').replace(/THB$/, '');

    return (
      <tr className="pos" style={{ opacity: a.triggered ? 0.6 : 1 }}>
        <td>
          <span className="tk">
            <span className="av" style={{ background: badgeBg, borderRadius: 7, fontSize: 9 }}>
              {badgeLabel.slice(0, 3)}
            </span>
            <span style={{ fontWeight: 600 }}>{displayName}</span>
          </span>
        </td>
        <td>
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700,
            background: a.condition === 'above' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
            color: a.condition === 'above' ? 'var(--green-600)' : 'var(--red-600)',
          }}>
            {a.condition === 'above' ? '▲ Above' : '▼ Below'}
          </span>
        </td>
        <td className="num" style={{ fontWeight: 700 }}>{a.price.toLocaleString()}</td>
        <td className="num" style={{ color: hitNow ? 'var(--green-600)' : 'var(--fg-3)' }}>
          {cur !== null
            ? cur.toLocaleString()
            : nhLoading && !pos ? <span style={{ color: 'var(--fg-4)', fontSize: 11 }}>…</span> : '—'}
        </td>
        <td className="num" style={{ fontSize: 12, color: distPct !== null ? (Math.abs(distPct) < 2 ? '#f59e0b' : 'var(--fg-3)') : 'var(--fg-4)' }}>
          {distPct !== null ? (distPct >= 0 ? '+' : '') + distPct.toFixed(1) + '%' : '—'}
        </td>
        <td style={{ fontSize: 12, color: 'var(--fg-3)' }}>{a.note || '—'}</td>
        <td>
          {a.triggered ? (
            <span style={{ fontSize: 11, color: 'var(--green-600)', fontWeight: 700 }}>✓ Triggered</span>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="icon-toggle" onClick={() => { setEditAlert(a); setModalOpen(true); }}><Icon name="edit-2" size={13} /></button>
              <button className="icon-toggle" onClick={() => Store.deletePriceAlert(a.id)} style={{ color: 'var(--red-600)' }}><Icon name="trash-2" size={13} /></button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  const thead = (
    <thead>
      <tr>
        <th>Holding</th>
        <th>Condition</th>
        <th className="num">Target Price</th>
        <th className="num">Current</th>
        <th className="num">Distance</th>
        <th>Note</th>
        <th />
      </tr>
    </thead>
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Price Alerts</h1>
          <div className="t-small">Get Telegram notifications when a holding crosses your target price</div>
        </div>
        <Button size="sm" icon="plus" onClick={() => { setEditAlert(null); setModalOpen(true); }}>Add alert</Button>
      </div>

      {alerts.length === 0 && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No alerts set</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 20 }}>
            Add price alerts and receive Telegram notifications when a holding hits your target price.
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>Add first alert</Button>
        </div>
      )}

      {active.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><div className="t">Active alerts ({active.length})</div></div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="ptable">{thead}<tbody>{active.map(a => <AlertRow key={a.id} a={a} />)}</tbody></table>
          </div>
        </div>
      )}

      {triggered.length > 0 && (
        <div className="card">
          <div className="card-h">
            <div className="t">Triggered alerts ({triggered.length})</div>
            <button className="icon-toggle" title="Clear all triggered"
                    onClick={() => triggered.forEach(a => Store.deletePriceAlert(a.id))}
                    style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              <Icon name="trash-2" size={13} /> Clear
            </button>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="ptable">{thead}<tbody>{triggered.map(a => <AlertRow key={a.id} a={a} />)}</tbody></table>
          </div>
        </div>
      )}

      {modalOpen && (
        <PriceAlertModal alert={editAlert} onClose={() => { setModalOpen(false); setEditAlert(null); }} />
      )}
    </div>
  );
}
