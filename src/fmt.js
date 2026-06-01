/* eslint-disable */
/* fmt.js — number / currency formatting helpers (global) */

window.ccySymbol = (c) => (c === 'USD' ? '$' : '฿');

window._amountsHidden = () => (typeof Store !== 'undefined' && Store.settings && Store.settings().hideAmounts);

window.fmtMoney = (n, ccy, dec) => {
  if (n == null || isNaN(n)) return '—';
  if (window._amountsHidden()) return (window.ccySymbol(ccy) || '') + '***.**';
  const d = dec != null ? dec : (Math.abs(n) >= 1000 ? 0 : 2);
  return (window.ccySymbol(ccy) || '') + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// Compact KPI numbers — no decimals, grouped thousands. Caller prepends the symbol.
window.fmtBig = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (window._amountsHidden()) return '***';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

window.fmtNum = (n, dec = 2) => {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

// Quantity: up to 6 significant decimals, trims trailing zeros.
window.fmtQty = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return parseFloat(n.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
};

window.fmtPct = (n) => {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
};

window.fmtPrice = (n, ccy) => {
  if (n == null || isNaN(n)) return '—';
  if (window._amountsHidden()) return (window.ccySymbol(ccy) || '') + '***.**';
  const d = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 2 : 4;
  return (window.ccySymbol(ccy) || '') + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// Multi-currency formatter — 0 decimals for JPY/KRW, 2 for THB/USD.
window.fmtCcy = (n, ccy) => {
  if (n == null || isNaN(n)) return '—';
  if (window._amountsHidden()) {
    const sym = ccy === 'USD' ? '$' : ccy === 'JPY' ? '¥' : ccy === 'KRW' ? '₩' : '฿';
    return sym + '***.**';
  }
  const dec = (ccy === 'JPY' || ccy === 'KRW') ? 0 : 2;
  const sym = ccy === 'USD' ? '$' : ccy === 'JPY' ? '¥' : ccy === 'KRW' ? '₩' : '฿';
  return sym + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

window.timeAgo = (ts) => {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
};
