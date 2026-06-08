/* eslint-disable */
/* HoldingModal.jsx — add / edit a single buy lot */

const OTHER_TYPES = ['Provident Fund', 'Insurance', 'Debenture', 'Bond', 'Other'];

function HoldingModal({ open, onClose, classKey, lot }) {
  const cls     = classKey ? Store.classByKey(classKey) : null;
  const isOther = classKey === 'other';
  const isCrypto = classKey === 'crypto';
  const editing = !!lot;
  const blank   = { name: '', type: 'Debenture', price: '', qty: '', cur: '', sector: '', note: '' };
  const [f, setF] = React.useState(blank);

  // Wallet deduction state
  const [deductOn,      setDeductOn]      = React.useState(false);
  const [walletAccId,   setWalletAccId]   = React.useState('');
  const [walletFxRate,  setWalletFxRate]  = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (lot) {
      setF({
        name:   lot.name || '',
        type:   lot.type || 'Debenture',
        price:  lot.price ?? '',
        qty:    lot.qty ?? '',
        cur:    lot.cur ?? '',
        sector: Store.get().sectors[classKey + ':' + lot.name] || '',
        note:   Store.getHoldingNote(classKey, lot.name) || '',
      });
    } else {
      setF(blank);
      setDeductOn(false);
      setWalletAccId('');
      setWalletFxRate('');
    }
  }, [open, lot, classKey]);

  if (!open || !cls) return null;
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  const priceN = parseFloat(f.price) || 0;
  const qtyN   = parseFloat(f.qty)   || 0;
  const curN   = f.cur !== '' ? parseFloat(f.cur) : priceN;
  const cost   = priceN * qtyN;
  const value  = curN   * qtyN;
  const profit = value - cost;
  const valid  = f.name.trim() && qtyN > 0 && priceN > 0;

  // Wallet deduction helpers
  const walletAccounts = (Store.getWallet().accounts || []).filter(a => !a.archived);
  const selectedWalletAcc = walletAccounts.find(a => a.id === walletAccId);
  const assetCcy = cls ? cls.ccy : 'THB';
  const crossCcy = selectedWalletAcc && selectedWalletAcc.currency !== assetCcy;
  const fxN = parseFloat(walletFxRate) ||
    (crossCcy ? Store.defaultFxRate(assetCcy, selectedWalletAcc.currency) : 1);
  const deductAmount = cost * (crossCcy ? fxN : 1);
  const deductCcy    = selectedWalletAcc ? selectedWalletAcc.currency : assetCcy;

  const save = () => {
    if (!valid) return;
    const payload = { name: f.name.trim(), price: f.price, qty: f.qty, cur: f.cur, sector: f.sector.trim() || undefined };
    if (isOther) payload.type = f.type;
    if (editing) {
      Store.updateLot(classKey, lot.id, payload);
      Store.setHoldingNote(classKey, f.name.trim(), f.note);
    } else {
      const walletData = deductOn && walletAccId
        ? { accountId: walletAccId, exchangeRate: crossCcy ? fxN : null }
        : null;
      Store.addLot(classKey, payload, walletData);
      if (f.note.trim()) Store.setHoldingNote(classKey, f.name.trim(), f.note);
    }
    onClose();
  };

  const footer = (
    <React.Fragment>
      <span className="muted t-small">{cls.label} · {cls.ccy}</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="accent" icon={editing ? 'check' : 'plus'} onClick={save} disabled={!valid}>
          {editing ? 'Save lot' : 'Add lot'}
        </Button>
      </span>
    </React.Fragment>
  );

  return (
    <Modal open={open} onClose={onClose}
           title={editing ? 'Edit holding' : 'Add to ' + cls.label}
           subtitle={editing ? f.name : 'Record a purchase lot. Multiple lots per ticker are auto-aggregated.'}
           footer={footer} width={520}>
      <div className="mgrid">
        <div className="full">
          <label className="flabel">{isOther ? 'Name / Symbol' : 'Ticker / Symbol'}</label>
          <input className="input" value={f.name} onChange={set('name')}
                 placeholder={isOther ? 'e.g. BCP292A' : isCrypto ? 'e.g. BTC, ETH, SOL' : 'e.g. AAPL'}
                 autoFocus />
        </div>

        {isOther && (
          <div className="full">
            <label className="flabel">Type</label>
            <select className="input" value={f.type} onChange={set('type')}>
              {OTHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="flabel">Purchase price ({cls.ccy})</label>
          <input className="input" type="number" step="any" value={f.price} onChange={set('price')} placeholder="0.00" />
        </div>
        <div>
          <label className="flabel">Quantity / Units</label>
          <input className="input" type="number" step="any" value={f.qty} onChange={set('qty')} placeholder="0" />
        </div>

        <div>
          <label className="flabel">Current price ({cls.ccy})</label>
          <input className="input" type="number" step="any" value={f.cur} onChange={set('cur')} placeholder="defaults to purchase" />
          {cls.live && <div className="t-small" style={{ marginTop: 5 }}>Auto-updated from {cls.srcLabel} on refresh.</div>}
        </div>
        {!isCrypto && (
          <div>
            <label className="flabel">Sector / Tag</label>
            <input className="input" value={f.sector} onChange={set('sector')} placeholder="e.g. Technology" list="sectorlist" />
            <datalist id="sectorlist">
              {window.SECTOR_TAGS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
        )}

        <div className="full">
          <label className="flabel">Investment note / thesis (optional)</label>
          <input className="input" value={f.note} onChange={set('note')}
                 placeholder="e.g. Long-term hold, DCA plan, target exit at…" />
        </div>

        <div className="full computed">
          <div className="c"><small>Cost</small>{window.fmtMoney(cost, cls.ccy, 2)}</div>
          <div className="c"><small>Market value</small>{window.fmtMoney(value, cls.ccy, 2)}</div>
          <div className="c">
            <small>Unrealized P/L</small>
            <span className={profit >= 0 ? 'up' : 'down'}>
              {(profit >= 0 ? '+' : '−') + window.fmtMoney(Math.abs(profit), cls.ccy, 2)}
            </span>
          </div>
        </div>

        {/* Wallet deduction — only for new lots */}
        {!editing && (
          <div className="full" style={{ borderTop: '1px solid var(--border-1)', paddingTop: 14, marginTop: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={deductOn} onChange={e => setDeductOn(e.target.checked)}
                     style={{ width: 14, height: 14, cursor: 'pointer' }} />
              <span style={{ fontWeight: 600, fontSize: 12 }}>Deduct purchase cost from wallet account</span>
            </label>

            {deductOn && (
              <div className="mgrid" style={{ marginTop: 10 }}>
                <div>
                  <label className="flabel">Wallet Account</label>
                  <select className="input" value={walletAccId} onChange={e => { setWalletAccId(e.target.value); setWalletFxRate(''); }}>
                    <option value="">Select account…</option>
                    {walletAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                  {walletAccounts.length === 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>No wallet accounts yet. Add one in the Wallet section first.</div>
                  )}
                </div>

                {crossCcy && (
                  <div>
                    <label className="flabel">Exchange Rate (1 {assetCcy} = ? {deductCcy})</label>
                    <input className="input" type="number" step="any" min="0"
                           value={walletFxRate}
                           placeholder={fxN.toFixed(4)}
                           onChange={e => setWalletFxRate(e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
                      Default from live rates. Override if you paid a different rate.
                    </div>
                  </div>
                )}

                {selectedWalletAcc && cost > 0 && (
                  <div className="full">
                    <div style={{ background: 'var(--bg-inset,var(--bg-app))', borderRadius: 6, padding: '8px 12px',
                                  fontSize: 12, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--red-600)' }}>−</span>
                      <strong style={{ color: 'var(--red-600)' }}>{window.fmtCcy(deductAmount, deductCcy)}</strong>
                      <span style={{ color: 'var(--fg-3)' }}>
                        will be deducted from <strong>{selectedWalletAcc.name}</strong>
                        {crossCcy && ` (at ${fxN.toFixed(4)} ${assetCcy}/${deductCcy})`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

window.HoldingModal = HoldingModal;
