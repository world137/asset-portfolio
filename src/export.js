/* export.js — CSV / data export utilities */

(function () {
  function escapeCSV(v) {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(rows) {
    return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  }

  function downloadCSV(filename, rows) {
    const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.exportHoldingsCSV = function () {
    const rows = [['Class', 'Ticker', 'Sector', 'Units', 'Avg Cost', 'Current Price', 'Cost (THB)', 'Value (THB)', 'P/L (THB)', 'P/L %']];
    const USDTHB = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;
    for (const cls of window.ASSET_CLASSES) {
      for (const p of Store.positions(cls.key)) {
        const toTHB = v => cls.ccy === 'USD' ? v * USDTHB : v;
        rows.push([
          cls.label,
          p.name.replace(/THB$/, ''),
          p.sector || '',
          p.qty,
          p.avgPrice.toFixed(4),
          p.cur != null ? p.cur.toFixed(4) : '',
          toTHB(p.cost).toFixed(2),
          toTHB(p.value).toFixed(2),
          toTHB(p.profit).toFixed(2),
          p.pct.toFixed(2),
        ]);
      }
    }
    downloadCSV('holdings_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  };

  window.exportSellLogCSV = function () {
    const rows = [['Date', 'Class', 'Ticker', 'Qty', 'Buy Price', 'Sell Price', 'Cost', 'Proceeds', 'P/L', 'P/L %', 'Currency']];
    const USDTHB = Store.get().fx.USDTHB || window.SEED_FX_USDTHB;
    for (const s of Store.getSales()) {
      rows.push([
        s.date,
        s.classKey,
        s.name.replace(/THB$/, ''),
        s.qty,
        s.buyPrice,
        s.sellPrice,
        s.cost,
        s.proceeds,
        s.realizedPnl,
        s.pnlPct.toFixed(2),
        s.ccy || 'THB',
      ]);
    }
    downloadCSV('sell_log_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  };

  window.exportSnapshotsCSV = function () {
    const snapshots = Store.getSnapshots();
    if (!snapshots.length) return;
    const classKeys = window.ASSET_CLASSES.map(c => c.key);
    const headers   = ['Date', 'Total (THB)', ...classKeys.map(k => (window.ASSET_CLASSES.find(c => c.key === k) || {}).label || k)];
    const rows = [headers];
    for (const s of [...snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
      rows.push([s.date, s.value, ...classKeys.map(k => s[k] != null ? s[k] : '')]);
    }
    downloadCSV('portfolio_history_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  };

  window.exportDividendsCSV = function () {
    const rows = [['Pay Date', 'Ex Date', 'Class', 'Ticker', 'Amount/Share', 'Total Amount', 'Currency', 'Note']];
    for (const d of Store.getDividends()) {
      rows.push([d.payDate, d.exDate || '', d.classKey, d.name.replace(/THB$/, ''), d.amountPerShare || '', d.totalAmount || '', d.currency, d.note || '']);
    }
    downloadCSV('dividends_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  };
})();
