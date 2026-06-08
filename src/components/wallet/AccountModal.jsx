/* eslint-disable */
/* AccountModal.jsx — Add / edit a wallet account */

function AccountModal({ open, account, onClose }) {
  const blank = { name: '', type: 'bank', currency: 'THB', color: '', initialBal: '', creditLimit: '', openingFxRateTHB: '' };
  const [f, setF] = React.useState(blank);

  React.useEffect(() => {
    if (!open) return;
    if (account) {
      setF({
        name:             account.name,
        type:             account.type,
        currency:         account.currency,
        color:            account.color || '',
        initialBal:       account.initialBal != null ? String(account.initialBal) : '',
        creditLimit:      account.creditLimit != null ? String(account.creditLimit) : '',
        openingFxRateTHB: account.openingFxRateTHB != null ? String(account.openingFxRateTHB) : '',
      });
    } else {
      setF(blank);
    }
  }, [open, account]);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const valid = f.name.trim() && f.type && f.currency;
  const editing = !!account;

  const save = () => {
    if (!valid) return;
    const patch = {
      name:             f.name.trim(),
      type:             f.type,
      currency:         f.currency,
      color:            f.color || null,
      initialBal:       f.initialBal !== '' ? +f.initialBal : 0,
      creditLimit:      f.type === 'credit_card' && f.creditLimit !== '' ? +f.creditLimit : null,
      openingFxRateTHB: f.currency !== 'THB' && f.openingFxRateTHB !== '' ? +f.openingFxRateTHB : null,
    };
    if (editing) Store.updateAccount(account.id, patch);
    else         Store.addAccount(patch);
    onClose();
  };

  const footer = (
    <React.Fragment>
      {editing && (
        <Button variant="ghost" style={{ marginRight: 'auto', color: 'var(--red-600)' }}
                onClick={() => { if (confirm('Delete this account and all its transactions?')) { Store.deleteAccount(account.id); onClose(); } }}>
          Delete
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="accent" onClick={save} disabled={!valid}>
        {editing ? 'Save' : 'Add Account'}
      </Button>
    </React.Fragment>
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Account' : 'Add Account'} footer={footer} width={480}>
      <div className="mgrid">
        <div className="full">
          <label className="flabel">Account Name</label>
          <input className="input" placeholder="e.g. SCB Savings" value={f.name} onChange={set('name')} autoFocus />
        </div>

        <div>
          <label className="flabel">Type</label>
          <select className="input" value={f.type} onChange={set('type')}>
            {(window.ACCOUNT_TYPES || []).map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flabel">Currency</label>
          <select className="input" value={f.currency} onChange={set('currency')} disabled={editing}>
            {(window.WALLET_CURRENCIES || ['THB', 'USD', 'JPY', 'KRW']).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {editing && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>Currency cannot be changed after creation.</div>}
        </div>

        <div>
          <label className="flabel">Opening Balance</label>
          <input className="input" type="number" placeholder="0" value={f.initialBal} onChange={set('initialBal')} />
        </div>

        {f.type === 'credit_card' && (
          <div>
            <label className="flabel">Credit Limit</label>
            <input className="input" type="number" placeholder="e.g. 50000" value={f.creditLimit} onChange={set('creditLimit')} />
          </div>
        )}

        {f.currency !== 'THB' && (
          <div className="full">
            <label className="flabel">Opening FX Rate (1 {f.currency || '?'} = ? THB)</label>
            <input className="input" type="number" min="0" step="any"
                   placeholder={f.currency === 'USD' ? 'e.g. 35.5' : f.currency === 'JPY' ? 'e.g. 0.23' : 'e.g. 0.026'}
                   value={f.openingFxRateTHB} onChange={set('openingFxRateTHB')} />
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
              Used to calculate unrealized FX gain/loss on the account balance. Optional.
            </div>
          </div>
        )}

        <div className={f.type === 'credit_card' ? '' : 'full'}>
          <label className="flabel">Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(window.ACCOUNT_COLORS || []).map(c => (
              <span key={c} onClick={() => setF(s => ({ ...s, color: c }))}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                             border: f.color === c ? '3px solid var(--fg-1)' : '2px solid transparent',
                             boxSizing: 'border-box' }} />
            ))}
            <input type="color" value={f.color || '#5a6677'}
                   onChange={e => setF(s => ({ ...s, color: e.target.value }))}
                   style={{ width: 28, height: 22, borderRadius: 4, border: '1px solid var(--border-1)', cursor: 'pointer', padding: 1 }}
                   title="Custom color" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
