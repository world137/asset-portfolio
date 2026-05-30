/* eslint-disable */
/* HoldingModal.jsx — add / edit a single buy lot */

const OTHER_TYPES = ['Provident Fund', 'Insurance', 'Debenture', 'Bond', 'Other'];

function HoldingModal({ open, onClose, classKey, lot }) {
  const cls     = classKey ? Store.classByKey(classKey) : null;
  const isOther = classKey === 'other';
  const isCrypto = classKey === 'crypto';
  const editing = !!lot;
  const blank   = { name: '', type: 'Debenture', price: '', qty: '', cur: '', sector: '' };
  const [f, setF] = React.useState(blank);

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
      });
    } else {
      setF(blank);
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

  const save = () => {
    if (!valid) return;
    const payload = { name: f.name.trim(), price: f.price, qty: f.qty, cur: f.cur, sector: f.sector.trim() || undefined };
    if (isOther) payload.type = f.type;
    if (editing) Store.updateLot(classKey, lot.id, payload);
    else         Store.addLot(classKey, payload);
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
        <div>
          <label className="flabel">Sector / Tag</label>
          <input className="input" value={f.sector} onChange={set('sector')} placeholder="e.g. Technology" list="sectorlist" />
          <datalist id="sectorlist">
            {window.SECTOR_TAGS.map(s => <option key={s} value={s} />)}
          </datalist>
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
      </div>
    </Modal>
  );
}

window.HoldingModal = HoldingModal;
