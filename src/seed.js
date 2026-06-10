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
  BTC:    { id: 'bitcoin',       sym: 'BTC' },
  ETH:    { id: 'ethereum',      sym: 'ETH' },
  BNB:    { id: 'binancecoin',   sym: 'BNB' },
  SOL:    { id: 'solana',        sym: 'SOL' },
  XRP:    { id: 'ripple',        sym: 'XRP' },
  USDT:   { id: 'tether',        sym: 'USDT' },
  USDC:   { id: 'usd-coin',      sym: 'USDC' },
  ADA:    { id: 'cardano',       sym: 'ADA' },
  DOGE:   { id: 'dogecoin',      sym: 'DOGE' },
  DOT:    { id: 'polkadot',      sym: 'DOT' },
  AVAX:   { id: 'avalanche-2',   sym: 'AVAX' },
  LINK:   { id: 'chainlink',     sym: 'LINK' },
  LTC:    { id: 'litecoin',      sym: 'LTC' },
  MATIC:  { id: 'matic-network', sym: 'MATIC' },
  // legacy holding-name keys (kept for backward compat with existing holdings)
  BTCTHB: { id: 'bitcoin',       sym: 'BTC' },
  ETHTHB: { id: 'ethereum',      sym: 'ETH' },
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

// ── Seed tags (applied once if user's DB has no tags yet) ─────────────────────
window.SEED_TAGS = [
  { id: '9f4yrqb', name: 'Divided',   color: '#3b82f6' },
  { id: 'xbe3mor', name: 'Core',      color: '#01c7fc' },
  { id: 'b3qkdx4', name: 'Growth',    color: '#669d34' },
  { id: 'j3vufwe', name: 'High risk', color: '#e22400' },
  { id: '2x57vnk', name: 'Defensive', color: '#ffab01' },
  { id: '4ho346i', name: 'AI',        color: '#be38f3' },
];

window.SEED_HOLDING_TAGS = {
  'usaStock:SNDK':  ['b3qkdx4', 'j3vufwe', '4ho346i'],
  'usaStock:STX':   ['4ho346i', 'b3qkdx4', 'j3vufwe'],
  'usaStock:TATT':  ['b3qkdx4', 'j3vufwe'],
  'usaStock:TSM':   ['4ho346i', 'b3qkdx4'],
  'usaStock:UNH':   ['2x57vnk', 'b3qkdx4'],
  'usaStock:WMT':   ['2x57vnk'],
  'crypto:BTCTHB':  ['j3vufwe'],
  'crypto:ETHTHB':  ['j3vufwe'],
  'crypto:SOL':     ['j3vufwe'],
  'etf:ICIN':       ['2x57vnk', 'b3qkdx4'],
  'etf:ICLN':       ['2x57vnk'],
  'etf:QQQM':       ['2x57vnk', 'b3qkdx4'],
  'etf:SMH':        ['4ho346i', 'b3qkdx4'],
  'etf:VOO':        ['2x57vnk', 'b3qkdx4'],
  'fund:A-GRID':    ['b3qkdx4'],
  'fund:A-SLVP':    ['j3vufwe'],
  'fund:ASP-S&P500-A':       ['2x57vnk', '9f4yrqb'],
  'fund:DAOL-DEFENSE':       ['b3qkdx4'],
  'fund:DAOL-KOREAEQ':       ['b3qkdx4'],
  'fund:ES-GTECH':           ['b3qkdx4'],
  'fund:K-GOLD-A(A)':        ['j3vufwe'],
  'fund:ONE-RAREEARTH':      ['2x57vnk'],
  'fund:PRINCIPAL GCLOUD-A': ['b3qkdx4'],
  'fund:SCBSEMI(A)':         ['4ho346i', 'b3qkdx4'],
  'fund:TEMxCH':             ['b3qkdx4'],
  'fund:TLNDQINCOME-UH-X':   ['9f4yrqb', 'b3qkdx4'],
  'gold:GOLD':               ['2x57vnk'],
  'other:BCP26NB':           ['9f4yrqb'],
  'other:BCP292A':           ['9f4yrqb'],
  'other:CPALL245B':         ['9f4yrqb'],
  'other:GULF298A':          ['9f4yrqb'],
  'other:MTC286A':           ['9f4yrqb'],
  'other:Provident Fund':    ['2x57vnk'],
  'other:SB348B':            ['9f4yrqb'],
  'other:ประกันสะสมทรัพย์':  ['2x57vnk'],
  'thaiStock:KKP':           ['9f4yrqb', 'xbe3mor'],
  'thaiStock:SCB':           ['9f4yrqb', 'xbe3mor'],
  'usaStock:AAOI':           ['4ho346i', 'j3vufwe'],
  'usaStock:AAPL':           ['b3qkdx4', 'xbe3mor'],
  'usaStock:AMZN':           ['b3qkdx4', 'xbe3mor'],
  'usaStock:ASTS':           ['b3qkdx4', 'j3vufwe'],
  'usaStock:GEV':            ['4ho346i', 'j3vufwe'],
  'usaStock:GOOGL':          ['b3qkdx4', 'xbe3mor'],
  'usaStock:JNJ':            ['2x57vnk'],
  'usaStock:TTAT':           ['b3qkdx4'],
  'usaStock:JPM':            ['2x57vnk'],
  'usaStock:LITE':           ['4ho346i', 'j3vufwe'],
  'usaStock:LLY':            ['2x57vnk', 'xbe3mor'],
  'usaStock:MRVL':           ['4ho346i', 'j3vufwe'],
  'usaStock:MSFT':           ['b3qkdx4', 'xbe3mor'],
  'usaStock:NOK':            ['j3vufwe', '4ho346i'],
  'usaStock:PRME':           ['b3qkdx4', 'j3vufwe'],
  'usaStock:RBRK':           ['j3vufwe'],
};

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
