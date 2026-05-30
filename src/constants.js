/* eslint-disable */
/* constants.js — app-wide shared constants */

// ── Price refresh ─────────────────────────────────────────────────────────────
window.PRICE_REFRESH_MS = 12 * 60 * 60 * 1000; // 12 hours

// ── Snapshot history cap ──────────────────────────────────────────────────────
window.MAX_SNAPSHOTS = 730; // ~2 years of daily snapshots

// ── Sector color palette (12 colors, cycles for >12 sectors) ─────────────────
window.SECTOR_PALETTE = [
  '#9a6b1f', '#2962ab', '#1f7a4d', '#b6862f',
  '#3b8bd0', '#c79a3a', '#8a6310', '#5a6677',
  '#b43a3a', '#2c3a52', '#7a5012', '#1f4a85',
];

// ── Sector tag suggestions (used in datalist inputs) ─────────────────────────
window.SECTOR_TAGS = [
  'Technology', 'Semiconductor', 'Financials', 'Healthcare',
  'Consumer', 'Energy', 'Industrials', 'Materials',
  'Aerospace', 'S&P 500', 'Korea', 'China',
  'Commodity', 'Infrastructure', 'Income',
];

// ── Dashboard layout options ──────────────────────────────────────────────────
window.LAYOUT_OPTIONS = [
  ['overview', 'Overview'],
  ['compact', 'Compact'],
  ['visual', 'Visual'],
];
