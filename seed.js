/* eslint-disable */
/* ============================================================================
   seed.js — Initial portfolio data parsed from "Investment Port.xlsx"
   Each holding is a single BUY LOT: { name, price, qty, cur }
     price = purchase price per unit (native currency)
     qty   = units held
     cur   = current price per unit (native currency) — manual classes seed from sheet
   Asset-class config defines display label, native currency, and live-price source.
   ============================================================================ */

// ---- Asset classes ---------------------------------------------------------
// live: source handled by /api/prices on Vercel. null = manual only.
//   'yahoo'    -> Yahoo chart API (symbol built from ticker)
//   'crypto'   -> CoinGecko vs THB
//   'settrade' -> settrade NUXT navPerUnit
// yahooSuffix / yahooSymbol shape the symbol sent to Yahoo.
window.ASSET_CLASSES = [
  { key: 'thaiStock', label: 'Thai Stock', short: 'SET',    ccy: 'THB', live: 'yahoo',    yahooSuffix: '.BK', srcLabel: 'Yahoo Finance', hint: 'SET-listed equities' },
  { key: 'usaStock',  label: 'USA Stock',  short: 'US',     ccy: 'USD', live: 'yahoo',    srcLabel: 'Yahoo Finance',                       hint: 'US-listed equities' },
  { key: 'etf',       label: 'ETF',        short: 'ETF',    ccy: 'USD', live: 'yahoo',    srcLabel: 'Yahoo Finance',                       hint: 'Exchange-traded funds' },
  { key: 'fund',      label: 'Thai Fund',  short: 'Fund',   ccy: 'THB', live: 'settrade', srcLabel: 'settrade.com',                        hint: 'Thai mutual funds' },
  { key: 'crypto',    label: 'Crypto',     short: 'Crypto', ccy: 'THB', live: 'crypto',   srcLabel: 'CoinGecko',                           hint: 'Live via CoinGecko' },
  { key: 'gold',      label: 'Gold',       short: 'Gold',   ccy: 'USD', live: 'yahoo',    yahooSymbol: 'GC=F', srcLabel: 'Yahoo Finance',  hint: 'Gold futures (GC=F)' },
  { key: 'other',     label: 'Other',      short: 'Other',  ccy: 'THB', live: null,                                                        hint: 'Funds, insurance, bonds' },
];

// ---- Categorical color per class (used by charts + accents) ----------------
window.CLASS_COLORS = {
  thaiStock: '#9a6b1f', // copper-600
  usaStock:  '#2962ab', // blue
  etf:       '#3b8bd0',
  fund:      '#1f7a4d', // green
  crypto:    '#b6862f', // copper-500
  gold:      '#c79a3a',
  other:     '#5a6677', // ink-500
};

// ---- Crypto → CoinGecko id + display symbol --------------------------------
window.CRYPTO_MAP = {
  SOL:    { id: 'solana',   sym: 'SOL' },
  BTCTHB: { id: 'bitcoin',  sym: 'BTC' },
  ETHTHB: { id: 'ethereum', sym: 'ETH' },
};

// ---- Sector tags (editable in-app). Key = "<class>:<ticker>" ---------------
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

// ---- FX: 1 USD = N THB (seed; refreshed live) ------------------------------
window.SEED_FX_USDTHB = 32.564;

// ---- Holdings (buy lots) ---------------------------------------------------
window.SEED_HOLDINGS = {
  thaiStock: [
    { name: 'SCB', price: 98.5, qty: 100, cur: 134.5 },
    { name: 'SCB', price: 117.5, qty: 100, cur: 134.5 },
    { name: 'KKP', price: 72, qty: 100, cur: 86.25 },
  ],
  usaStock: [
    { name: 'AAPL', price: 182.13, qty: 0.3145555, cur: 312.51 },
    { name: 'AAPL', price: 183.93, qty: 0.3381214, cur: 312.51 },
    { name: 'AAPL', price: 268.15, qty: 0.1116895, cur: 312.51 },
    { name: 'AMZN', price: 231.75, qty: 0.2154063, cur: 274 },
    { name: 'AMZN', price: 232.56, qty: 0.4293011, cur: 274 },
    { name: 'AMZN', price: 261.65, qty: 0.1509986, cur: 274 },
    { name: 'GOOGL', price: 176.49, qty: 0.0483318, cur: 390.13 },
    { name: 'GOOGL', price: 240.08, qty: 0.4158544, cur: 390.13 },
    { name: 'GOOGL', price: 246.85, qty: 0.18675, cur: 390.13 },
    { name: 'GOOGL', price: 331.52, qty: 0.2338306, cur: 390.13 },
    { name: 'JNJ', price: 175.61, qty: 0.28472, cur: 230.8 },
    { name: 'JPM', price: 296.61, qty: 0.13323, cur: 296.73 },
    { name: 'JPM', price: 311.68, qty: 0.045, cur: 296.73 },
    { name: 'MSFT', price: 426.69, qty: 0.0818857, cur: 426.99 },
    { name: 'MSFT', price: 505.36, qty: 0.3089666, cur: 426.99 },
    { name: 'ONDS', price: 10.3, qty: 3, cur: 13.25 },
    { name: 'SNDK', price: 597.82, qty: 0.1670067, cur: 1641.64 },
    { name: 'STX', price: 417.74, qty: 0.1194978, cur: 880.72 },
    { name: 'STX', price: 445.09, qty: 0.0913731, cur: 880.72 },
    { name: 'GEV', price: 1094.99, qty: 0.063827, cur: 996 },
    { name: 'TSM', price: 237.19, qty: 0.2108, cur: 424.86 },
    { name: 'WMT', price: 127.88, qty: 1.1710612, cur: 118.9 },
    { name: 'XOM', price: 153.53, qty: 0.9753937, cur: 146.96 },
    { name: 'XBI', price: 124.12, qty: 0.7231138, cur: 135.99 },
    { name: 'UNH', price: 286.08, qty: 0.348983, cur: 382.53 },
    { name: 'RKLB', price: 66.61, qty: 0.6475, cur: 148.03 },
    { name: 'ASTS', price: 83.24, qty: 0.18559, cur: 133.09 },
    { name: 'AAOI', price: 184.79, qty: 0.459219, cur: 169.02 },
    { name: 'NOK', price: 13.25, qty: 3.9559773, cur: 15.28 },
    { name: 'LITE', price: 973.31, qty: 0.076933, cur: 860.62 },
    { name: 'RBRK', price: 56.12, qty: 0.8005487, cur: 70.32 },
    { name: 'PRME', price: 2.94, qty: 10.2346938, cur: 3.4 },
    { name: 'MRVL', price: 197.46, qty: 0.1994287, cur: 204.83 },
  ],
  etf: [
    { name: 'QQQM', price: 234.18, qty: 0.651732, cur: 302.85 },
    { name: 'QQQM', price: 252.33, qty: 0.2010795, cur: 302.85 },
    { name: 'SMH', price: 385.54, qty: 0.12839, cur: 599.83 },
    { name: 'SMH', price: 402.22, qty: 0.1, cur: 599.83 },
    { name: 'VOO', price: 609.72, qty: 0.022, cur: 693.91 },
    { name: 'VOO', price: 613.41, qty: 0.01829, cur: 693.91 },
    { name: 'VOO', price: 622.08, qty: 0.08841, cur: 693.91 },
    { name: 'VOO', price: 627.61, qty: 0.07648, cur: 693.91 },
    { name: 'VOO', price: 633.32, qty: 0.15, cur: 693.91 },
    { name: 'VOO', price: 639.07, qty: 0.0751, cur: 693.91 },
  ],
  fund: [
    { name: 'ES-GTECH', price: 20.3208, qty: 98.4213, cur: 38.8677 },
    { name: 'ES-GTECH', price: 31.7664, qty: 31.4798, cur: 38.8677 },
    { name: 'ES-GTECH', price: 36.9491, qty: 27.0642586694, cur: 38.8677 },
    { name: 'ASP-S&P500-A', price: 57.7668, qty: 86.5549, cur: 69.8739 },
    { name: 'ASP-S&P500-A', price: 56.3612, qty: 88.7135, cur: 69.8739 },
    { name: 'DAOL-KOREAEQ', price: 14.5769, qty: 102.9025, cur: 23.2316 },
    { name: 'TEMxCH', price: 12.9019, qty: 155.0159, cur: 16.5984 },
    { name: 'DAOL-DEFENSE', price: 17.0716, qty: 146.442, cur: 14.5998 },
    { name: 'K-GOLD-A(A)', price: 27.0606, qty: 15.1497, cur: 23.0761 },
    { name: 'ONE-RAREEARTH', price: 11.9095, qty: 251.8997, cur: 12.7513 },
    { name: 'A-GRID', price: 10.3026, qty: 252.3239031, cur: 11.0288 },
    { name: 'PRINCIPAL GCLOUD-A', price: 4.8327, qty: 310.385498789, cur: 4.8266 },
    { name: 'TLNDQINCOME-UH-X', price: 10.0713, qty: 248.2301, cur: 10.8216 },
    { name: 'SCBSEMI(A)', price: 23.5158, qty: 224.4798, cur: 36.6259 },
    { name: 'A-SLVP', price: 11.7926, qty: 158.9193484, cur: 11.062 },
  ],
  crypto: [
    { name: 'SOL', price: 2836.48, qty: 0.703333, cur: 2836.48 },
    { name: 'BTCTHB', price: 2289650, qty: 0.00043565, cur: 2390689.316 },
    { name: 'BTCTHB', price: 2787022.53, qty: 0.00071581, cur: 2390689.316 },
    { name: 'BTCTHB', price: 3681286.04, qty: 0.00027164, cur: 2390689.316 },
    { name: 'BTCTHB', price: 3701800.92, qty: 0.00021464, cur: 2390689.316 },
    { name: 'ETHTHB', price: 142510.71, qty: 0.00840624, cur: 65304.86302 },
  ],
  gold: [
    { name: 'GOLD', price: 1992.78, qty: 0.0138, cur: 4535.3 },
    { name: 'GOLD', price: 2877.45, qty: 0.0509, cur: 4535.3 },
    { name: 'GOLD', price: 3312.04, qty: 0.0008, cur: 4535.3 },
    { name: 'GOLD', price: 3230.55, qty: 0.0046, cur: 4535.3 },
    { name: 'GOLD', price: 3289.35, qty: 0.0184, cur: 4535.3 },
    { name: 'GOLD', price: 3857.46, qty: 0.0159, cur: 4535.3 },
    { name: 'GOLD', price: 4791.96, qty: 0.000212, cur: 4535.3 },
    { name: 'GOLD', price: 5068.57, qty: 0.014359, cur: 4535.3 },
  ],
  other: [
    { name: 'Provident Fund', type: 'Provident Fund', price: 68426.28, qty: 1, cur: 69527.77 },
    { name: 'ประกันสะสมทรัพย์', type: 'Insurance', price: 300000.03, qty: 1, cur: 300000.03 },
    { name: 'BCP292A', type: 'Debenture', price: 40000, qty: 1, cur: 40000 },
    { name: 'BCP26NB', type: 'Debenture', price: 10000, qty: 1, cur: 10000 },
    { name: 'CPALL245B', type: 'Debenture', price: 5000, qty: 1, cur: 5000 },
    { name: 'GULF298A', type: 'Debenture', price: 5000, qty: 1, cur: 5000 },
    { name: 'MTC286A', type: 'Debenture', price: 100000, qty: 1, cur: 100000 },
    { name: 'SB348B', type: 'Bond', price: 50000, qty: 1, cur: 50000 },
  ],
};
