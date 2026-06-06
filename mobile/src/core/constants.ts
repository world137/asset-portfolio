// ── Price refresh ──────────────────────────────────────────────────────────────
export const PRICE_REFRESH_MS = 12 * 60 * 60 * 1000;

// ── Snapshot history cap ───────────────────────────────────────────────────────
export const MAX_SNAPSHOTS = 730;

// ── Asset classes ──────────────────────────────────────────────────────────────
export interface AssetClass {
  key: string;
  label: string;
  short: string;
  ccy: 'THB' | 'USD';
  live: 'yahoo' | 'crypto' | 'settrade' | null;
  yahooSuffix?: string;
  yahooSymbol?: string;
  srcLabel?: string;
  hint?: string;
}

export const ASSET_CLASSES: AssetClass[] = [
  { key: 'thaiStock', label: 'Thai Stock', short: 'SET',    ccy: 'THB', live: 'yahoo',    yahooSuffix: '.BK', srcLabel: 'Yahoo Finance', hint: 'SET-listed equities' },
  { key: 'usaStock',  label: 'USA Stock',  short: 'US',     ccy: 'USD', live: 'yahoo',    srcLabel: 'Yahoo Finance', hint: 'US-listed equities' },
  { key: 'etf',       label: 'ETF',        short: 'ETF',    ccy: 'USD', live: 'yahoo',    srcLabel: 'Yahoo Finance', hint: 'Exchange-traded funds' },
  { key: 'fund',      label: 'Thai Fund',  short: 'Fund',   ccy: 'THB', live: 'settrade', srcLabel: 'settrade.com', hint: 'Thai mutual funds' },
  { key: 'crypto',    label: 'Crypto',     short: 'Crypto', ccy: 'THB', live: 'crypto',   srcLabel: 'CoinGecko', hint: 'Live via CoinGecko' },
  { key: 'gold',      label: 'Gold',       short: 'Gold',   ccy: 'USD', live: 'yahoo',    yahooSymbol: 'GC=F', srcLabel: 'Yahoo Finance', hint: 'Gold futures (GC=F)' },
  { key: 'other',     label: 'Other',      short: 'Other',  ccy: 'THB', live: null,       hint: 'Funds, insurance, bonds' },
];

export const CLASS_COLORS: Record<string, string> = {
  thaiStock: '#9a6b1f',
  usaStock:  '#2962ab',
  etf:       '#3b8bd0',
  fund:      '#1f7a4d',
  crypto:    '#b6862f',
  gold:      '#c79a3a',
  other:     '#5a6677',
};

export const CRYPTO_MAP: Record<string, { id: string; sym: string }> = {
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
  BTCTHB: { id: 'bitcoin',       sym: 'BTC' },
  ETHTHB: { id: 'ethereum',      sym: 'ETH' },
};

export const SEED_SECTORS: Record<string, string> = {
  'thaiStock:SCB': 'Financials', 'thaiStock:KKP': 'Financials',
  'fund:ES-GTECH': 'Technology', 'fund:ASP-S&P500-A': 'S&P 500', 'fund:DAOL-KOREAEQ': 'Korea',
  'fund:TEMxCH': 'China', 'fund:DAOL-DEFENSE': 'Defense', 'fund:K-GOLD-A(A)': 'Commodity',
  'fund:ONE-RAREEARTH': 'Materials', 'fund:A-GRID': 'Infrastructure',
  'fund:PRINCIPAL GCLOUD-A': 'Technology', 'fund:TLNDQINCOME-UH-X': 'Income',
  'fund:SCBSEMI(A)': 'Semiconductor', 'fund:A-SLVP': 'Commodity',
  'etf:QQQM': 'Technology', 'etf:SMH': 'Semiconductor', 'etf:VOO': 'S&P 500',
  'usaStock:AAPL': 'Technology', 'usaStock:MSFT': 'Technology', 'usaStock:GOOGL': 'Technology',
  'usaStock:AMZN': 'Consumer', 'usaStock:JNJ': 'Healthcare', 'usaStock:UNH': 'Healthcare',
  'usaStock:JPM': 'Financials', 'usaStock:ONDS': 'Aerospace', 'usaStock:RKLB': 'Aerospace',
  'usaStock:ASTS': 'Aerospace', 'usaStock:GEV': 'Industrials', 'usaStock:SNDK': 'Technology',
  'usaStock:STX': 'Technology', 'usaStock:TSM': 'Semiconductor', 'usaStock:MRVL': 'Semiconductor',
  'usaStock:AAOI': 'Semiconductor', 'usaStock:LITE': 'Semiconductor', 'usaStock:WMT': 'Consumer',
  'usaStock:XOM': 'Energy', 'usaStock:XBI': 'Healthcare', 'usaStock:NOK': 'Technology',
  'usaStock:RBRK': 'Technology', 'usaStock:PRME': 'Healthcare',
  'gold:GOLD': 'Commodity',
};

export const SEED_FX = { USDTHB: 34.5, JPYTHB: 0.23, KRWTHB: 0.026 };

export const ACCOUNT_TYPES = [
  { key: 'bank',        label: 'Bank Account' },
  { key: 'cash',        label: 'Cash' },
  { key: 'credit_card', label: 'Credit Card' },
  { key: 'ewallet',     label: 'E-Wallet' },
];

export const WALLET_CURRENCIES = ['THB', 'USD', 'JPY', 'KRW'];

export const ACCOUNT_COLORS = ['#2962ab', '#1f7a4d', '#9a6b1f', '#7c3aed', '#0891b2', '#db2777'];

export const SECTOR_PALETTE = [
  '#9a6b1f', '#2962ab', '#1f7a4d', '#b6862f',
  '#3b8bd0', '#c79a3a', '#8a6310', '#5a6677',
  '#b43a3a', '#2c3a52', '#7a5012', '#1f4a85',
];

export const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#06b6d4', '#84cc16', '#a78bfa',
];

export const SECTOR_TAGS = [
  'Technology', 'Semiconductor', 'Financials', 'Healthcare',
  'Consumer', 'Energy', 'Industrials', 'Materials',
  'Aerospace', 'S&P 500', 'Korea', 'China',
  'Commodity', 'Infrastructure', 'Income',
];

export const DEFAULT_WALLET_CATEGORIES = [
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

// Base URL for all Vercel API calls (your production deployment)
export const API_BASE = 'https://asset-portfolio-world137s-projects.vercel.app';
