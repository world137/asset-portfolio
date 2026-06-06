// fmt.ts — number/currency formatting helpers (ported from fmt.js)
// Store is accessed via a callback to break circular dependency

let _hideAmounts = false;
export function setHideAmounts(v: boolean) { _hideAmounts = v; }

export function ccySymbol(c?: string): string {
  if (c === 'USD') return '$';
  if (c === 'JPY') return '¥';
  if (c === 'KRW') return '₩';
  return '฿';
}

export function fmtMoney(n: number | null | undefined, ccy?: string, dec?: number): string {
  if (n == null || isNaN(n)) return '—';
  if (_hideAmounts) return (ccySymbol(ccy) || '') + '***.**';
  const d = dec != null ? dec : (Math.abs(n) >= 1000 ? 0 : 2);
  return (ccySymbol(ccy) || '') + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtBig(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (_hideAmounts) return '***';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtNum(n: number | null | undefined, dec = 2): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtQty(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return parseFloat(n.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function fmtPrice(n: number | null | undefined, ccy?: string): string {
  if (n == null || isNaN(n)) return '—';
  if (_hideAmounts) return (ccySymbol(ccy) || '') + '***.**';
  const d = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 2 : 4;
  return (ccySymbol(ccy) || '') + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtCcy(n: number | null | undefined, ccy: string): string {
  if (n == null || isNaN(n)) return '—';
  if (_hideAmounts) return ccySymbol(ccy) + '***.**';
  const dec = (ccy === 'JPY' || ccy === 'KRW') ? 0 : 2;
  return ccySymbol(ccy) + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${d}, ${y}`;
}
