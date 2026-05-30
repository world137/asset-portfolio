/* eslint-disable */
/* ============================================================================
   seed.js — Static configuration: asset classes, colors, crypto mapping,
   default sector tags, and the seed FX rate.

   Holdings (buy lots) live in Supabase — not here.
   ============================================================================ */

// ── Asset classes ─────────────────────────────────────────────────────────────
// live: price source handled by /api/prices
//   'yahoo'    → Yahoo Finance chart API (symbol built from ticker)
//   'crypto'   → CoinGecko vs THB
//   'settrade' → settrade.com NAV per unit
//   null       → manual-only (no live price)
window.ASSET_CLASSES = [
  { key: 'thaiStock', label: 'Thai Stock', short: 'SET',    ccy: 'THB', live: 'yahoo',    yahooSuffix: '.BK', srcLabel: 'Yahoo Finance', hint: 'SET-listed equities' },
  { key: 'usaStock',  label: 'USA Stock',  short: 'US',     ccy: 'USD', live: 'yahoo',    srcLabel: 'Yahoo Finance',                       hint: 'US-listed equities' },
  { key: 'etf',       label: 'ETF',        short: 'ETF',    ccy: 'USD', live: 'yahoo',    srcLabel: 'Yahoo Finance',                       hint: 'Exchange-traded funds' },
  { key: 'fund',      label: 'Thai Fund',  short: 'Fund',   ccy: 'THB', live: 'settrade', srcLabel: 'settrade.com',                        hint: 'Thai mutual funds' },
  { key: 'crypto',    label: 'Crypto',     short: 'Crypto', ccy: 'THB', live: 'crypto',   srcLabel: 'CoinGecko',                           hint: 'Live via CoinGecko' },
  { key: 'gold',      label: 'Gold',       short: 'Gold',   ccy: 'USD', live: 'yahoo',    yahooSymbol: 'GC=F', srcLabel: 'Yahoo Finance',  hint: 'Gold futures (GC=F)' },
  { key: 'other',     label: 'Other',      short: 'Other',  ccy: 'THB', live: null,                                                        hint: 'Funds, insurance, bonds' },
];

// ── Color per asset class (charts + accents) ──────────────────────────────────
window.CLASS_COLORS = {
  thaiStock: '#9a6b1f',
  usaStock:  '#2962ab',
  etf:       '#3b8bd0',
  fund:      '#1f7a4d',
  crypto:    '#b6862f',
  gold:      '#c79a3a',
  other:     '#5a6677',
};

// ── Crypto → CoinGecko id mapping ─────────────────────────────────────────────
window.CRYPTO_MAP = {
  SOL:    { id: 'solana',   sym: 'SOL' },
  BTCTHB: { id: 'bitcoin',  sym: 'BTC' },
  ETHTHB: { id: 'ethereum', sym: 'ETH' },
};

// ── Default sector tags per ticker ("<class>:<ticker>" → sector) ──────────────
window.SEED_SECTORS = {
  // Thai stock
  'thaiStock:SCB': 'Financials', 'thaiStock:KKP': 'Financials',
  // Thai funds
  'fund:ES-GTECH': 'Technology', 'fund:ASP-S&P500-A': 'S&P 500', 'fund:DAOL-KOREAEQ': 'Korea',
  'fund:TEMxCH': 'China', 'fund:DAOL-DEFENSE': 'Defense', 'fund:K-GOLD-A(A)': 'Commodity',
  'fund:ONE-RAREEARTH': 'Materials', 'fund:A-GRID': 'Infrastructure', 'fund:PRINCIPAL GCLOUD-A': 'Technology',
  'fund:TLNDQINCOME-UH-X': 'Income', 'fund:SCBSEMI(A)': 'Semiconductor', 'fund:A-SLVP': 'Commodity',
  // ETF
  'etf:QQQM': 'Technology', 'etf:SMH': 'Semiconductor', 'etf:VOO': 'S&P 500',
  // USA stock
  'usaStock:AAPL': 'Technology', 'usaStock:MSFT': 'Technology', 'usaStock:GOOGL': 'Technology',
  'usaStock:AMZN': 'Consumer', 'usaStock:JNJ': 'Healthcare', 'usaStock:UNH': 'Healthcare',
  'usaStock:JPM': 'Financials', 'usaStock:ONDS': 'Aerospace', 'usaStock:RKLB': 'Aerospace',
  'usaStock:ASTS': 'Aerospace', 'usaStock:GEV': 'Industrials', 'usaStock:SNDK': 'Technology',
  'usaStock:STX': 'Technology', 'usaStock:TSM': 'Semiconductor', 'usaStock:MRVL': 'Semiconductor',
  'usaStock:AAOI': 'Semiconductor', 'usaStock:LITE': 'Semiconductor', 'usaStock:WMT': 'Consumer',
  'usaStock:XOM': 'Energy', 'usaStock:XBI': 'Healthcare', 'usaStock:NOK': 'Technology',
  'usaStock:RBRK': 'Technology', 'usaStock:PRME': 'Healthcare',
  // Gold
  'gold:GOLD': 'Commodity',
};

// ── Seed FX rates (overwritten by live refresh) ───────────────────────────────
window.SEED_FX_USDTHB = 34.5;
window.SEED_FX_JPYTHB = 0.23;   // approx 1 JPY ≈ 0.23 THB
window.SEED_FX_KRWTHB = 0.026;  // approx 1 KRW ≈ 0.026 THB

// ── Wallet: account types ─────────────────────────────────────────────────────
window.ACCOUNT_TYPES = [
  { key: 'bank',        label: 'Bank Account' },
  { key: 'cash',        label: 'Cash' },
  { key: 'credit_card', label: 'Credit Card' },
  { key: 'ewallet',     label: 'E-Wallet' },
];

// ── Wallet: supported currencies ──────────────────────────────────────────────
window.WALLET_CURRENCIES = ['THB', 'USD', 'JPY', 'KRW'];

// ── Wallet: default account colors ───────────────────────────────────────────
window.ACCOUNT_COLORS = ['#2962ab', '#1f7a4d', '#9a6b1f', '#7c3aed', '#0891b2', '#db2777'];

// ── Wallet: default categories ────────────────────────────────────────────────
window.DEFAULT_WALLET_CATEGORIES = [
  { id: 'cat_food',      name: 'Food & Drink',  flow: 'expense', icon: 'layers',        color: '#f59e0b' },
  { id: 'cat_transport', name: 'Transport',     flow: 'expense', icon: 'trending-down', color: '#3b82f6' },
  { id: 'cat_shopping',  name: 'Shopping',      flow: 'expense', icon: 'list',          color: '#ec4899' },
  { id: 'cat_bills',     name: 'Bills',         flow: 'expense', icon: 'file',          color: '#ef4444' },
  { id: 'cat_health',    name: 'Health',        flow: 'expense', icon: 'shield',        color: '#10b981' },
  { id: 'cat_travel',    name: 'Travel',        flow: 'expense', icon: 'layers',        color: '#8b5cf6' },
  { id: 'cat_other_exp', name: 'Other',         flow: 'expense', icon: 'dot',           color: '#6b7280' },
  { id: 'cat_salary',    name: 'Salary',        flow: 'income',  icon: 'check',         color: '#10b981' },
  { id: 'cat_invest_in', name: 'Investment',    flow: 'income',  icon: 'trending-down', color: '#2962ab' },
  { id: 'cat_gift',      name: 'Gift',          flow: 'income',  icon: 'success',       color: '#f59e0b' },
  { id: 'cat_other_inc', name: 'Other Income',  flow: 'income',  icon: 'dot',           color: '#6b7280' },
];
