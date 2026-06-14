/* controllers/alerts-controller.js — Non-holding alert price fetching.
   Extracted from AlertsView.jsx.
   Exposed as window.fetchNonHoldingPrices. */

async function fetchNonHoldingPrices(alerts) {
  const YAHOO_CLASSES = new Set(['thaiStock', 'usaStock', 'etf']);
  const yahooItems = alerts
    .filter(a => a.classKey && YAHOO_CLASSES.has(a.classKey))
    .map(a => ({ key: a.classKey, name: a.name, symbol: a.name }));
  if (!yahooItems.length) return {};
  const r = await fetch('/api/prices', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ yahoo: yahooItems }),
  });
  const j = await r.json();
  return (j && j.prices) ? j.prices : {};
}
