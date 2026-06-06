// store.ts — App state, persistence, calculations.
// Ported from src/store.js. Adaptations:
//   • localStorage → AsyncStorage (for portfolioId only)
//   • window.* globals → imported constants
//   • navigator.sendBeacon → plain fetch on app background
//   • window.addEventListener → removed (handled in App lifecycle)

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ASSET_CLASSES, SEED_SECTORS, SEED_FX, MAX_SNAPSHOTS,
  CLASS_COLORS, CRYPTO_MAP, DEFAULT_WALLET_CATEGORIES,
} from './constants';
import { API_BASE } from './constants';
import { setHideAmounts } from './fmt';

const USER_ID_KEY = 'portfolio.userId';
const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Lot {
  id: string;
  name: string;
  type?: string;
  price: number;
  qty: number;
  cur?: number;
}

export interface Settings {
  displayCcy: 'THB' | 'USD';
  theme: 'light' | 'dark';
  chartStyle: 'donut' | 'pie';
  palette: 'class' | 'sector' | 'tag';
  layout: 'overview' | 'compact' | 'visual';
  decimals: number;
  hideAmounts: boolean;
}

export interface Tag { id: string; name: string; color: string; }

export interface Snapshot {
  date: string;
  value: number;
  [key: string]: number | string;
}

export interface Sale {
  id: string; date: string; classKey: string; name: string; ccy: string;
  buyPrice: number; sellPrice: number; qty: number;
  cost: number; proceeds: number; realizedPnl: number; pnlPct: number;
}

export interface State {
  holdings: Record<string, Lot[]>;
  sectors: Record<string, string>;
  fx: { USDTHB: number; JPYTHB: number; KRWTHB: number; at: number | null };
  settings: Settings;
  lastPriceSync: number | null;
  priceMode: string | null;
  priceErrors: string[];
  snapshots: Snapshot[];
  sales: Sale[];
  tags: Tag[];
  holdingTags: Record<string, string[]>;
  prePostPrices: Record<string, { price: number; pct: number; type: 'pre' | 'post' }>;
  dayChangePrices: Record<string, number>;
}

export interface WalletAccount {
  id: string; name: string;
  type: 'bank' | 'cash' | 'credit_card' | 'ewallet';
  currency: string; color: string;
  initialBal: number; creditLimit?: number;
  sortOrder?: number; archived?: boolean;
}

export interface WalletCategory {
  id: string; name: string;
  flow: 'income' | 'expense';
  icon?: string; color: string;
}

export interface WalletTransaction {
  id: string; accountId: string; date: string; amount: number;
  flow: 'income' | 'expense' | 'transfer';
  categoryId?: string | null; note?: string;
  toAccountId?: string | null; fxRate?: number | null;
}

export interface Debt {
  id: string; direction: 'borrowed' | 'lent';
  counterparty: string; amount: number; currency: string;
  dateStart: string; dateDue?: string; note?: string;
  settled?: boolean; settledDate?: string;
  linkedAccountId?: string | null;
  installment?: { months: number; interestRate: number; paidMonths: number } | null;
}

export interface WalletState {
  accounts: WalletAccount[];
  categories: WalletCategory[];
  transactions: WalletTransaction[];
  debts: Debt[];
}

// ── Internal state ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: Settings = {
  displayCcy: 'THB',
  theme: 'light',
  chartStyle: 'donut',
  palette: 'class',
  layout: 'overview',
  decimals: 2,
  hideAmounts: false,
};

function freshState(): State {
  const holdings: Record<string, Lot[]> = {};
  for (const cls of ASSET_CLASSES) holdings[cls.key] = [];
  return {
    holdings,
    sectors: { ...SEED_SECTORS },
    fx: { USDTHB: SEED_FX.USDTHB, JPYTHB: SEED_FX.JPYTHB, KRWTHB: SEED_FX.KRWTHB, at: null },
    settings: { ...DEFAULT_SETTINGS },
    lastPriceSync: null,
    priceMode: null,
    priceErrors: [],
    snapshots: [],
    sales: [],
    tags: [],
    holdingTags: {},
    prePostPrices: {},
    dayChangePrices: {},
  };
}

function freshWallet(): WalletState {
  return {
    accounts: [],
    categories: DEFAULT_WALLET_CATEGORIES.map(c => ({ ...c } as WalletCategory)),
    transactions: [],
    debts: [],
  };
}

let portfolioId = '';
let state: State = freshState();
let wallet: WalletState = freshWallet();

let _dbStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'error' = 'idle';
let _dbSavedAt: number | null = null;
let _initialized = false;
let _initialLoadOk = false;
let _walletInitialized = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _walletSaveTimer: ReturnType<typeof setTimeout> | null = null;

// ── pub/sub ────────────────────────────────────────────────────────────────────
const subs = new Set<() => void>();
function emit() { scheduleCloudSave(); subs.forEach(fn => fn()); }
function emitOnly() { subs.forEach(fn => fn()); }

// ── Cloud save / load ──────────────────────────────────────────────────────────
function buildSavePayload() {
  return JSON.stringify({
    holdings: state.holdings, sectors: state.sectors, fx: state.fx,
    settings: state.settings, lastPriceSync: state.lastPriceSync,
    priceMode: state.priceMode, snapshots: state.snapshots, sales: state.sales,
    tags: state.tags, holdingTags: state.holdingTags,
  });
}

function scheduleCloudSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _dbStatus = 'pending';
  emitOnly();
  _saveTimer = setTimeout(doCloudSave, 500);
}

async function doCloudSave() {
  _saveTimer = null;
  if (!_initialized || !_initialLoadOk) { _dbStatus = 'idle'; emitOnly(); return; }
  _dbStatus = 'saving';
  emitOnly();
  try {
    const r = await fetch(`${API_BASE}/api/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: portfolioId, data: buildSavePayload() }),
    });
    if (r.ok) {
      _dbStatus = 'saved';
      _dbSavedAt = Date.now();
    } else {
      _dbStatus = 'error';
    }
  } catch {
    _dbStatus = 'error';
  }
  emitOnly();
}

function scheduleWalletSave() {
  if (_walletSaveTimer) clearTimeout(_walletSaveTimer);
  _walletSaveTimer = setTimeout(doWalletSave, 500);
}

async function doWalletSave() {
  _walletSaveTimer = null;
  if (!_walletInitialized) return;
  try {
    await fetch(`${API_BASE}/api/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: portfolioId, data: JSON.stringify(wallet) }),
    });
  } catch (e) {
    console.warn('[wallet] save error:', e);
  }
}

function restoreFromSaved(saved: Partial<State>): State {
  const base = freshState();
  const savedFx = (saved.fx || {}) as Partial<State['fx']>;
  return {
    holdings: saved.holdings || base.holdings,
    sectors: { ...base.sectors, ...(saved.sectors || {}) },
    fx: {
      USDTHB: savedFx.USDTHB || base.fx.USDTHB,
      JPYTHB: savedFx.JPYTHB || base.fx.JPYTHB,
      KRWTHB: savedFx.KRWTHB || base.fx.KRWTHB,
      at: savedFx.at || null,
    },
    settings: { ...base.settings, ...(saved.settings || {}) },
    lastPriceSync: saved.lastPriceSync || null,
    priceMode: saved.priceMode || null,
    priceErrors: [],
    snapshots: (saved.snapshots || []).slice(-MAX_SNAPSHOTS),
    sales: saved.sales || [],
    tags: saved.tags || [],
    holdingTags: saved.holdingTags || {},
    prePostPrices: {},
    dayChangePrices: {},
  };
}

function restoreWalletFromSaved(saved: Partial<WalletState>): WalletState {
  const base = freshWallet();
  const savedCats = saved.categories || [];
  return {
    accounts:     saved.accounts     || [],
    categories:   savedCats.length ? savedCats : base.categories,
    transactions: saved.transactions || [],
    debts:        saved.debts        || [],
  };
}

// ── Currency conversion ────────────────────────────────────────────────────────
function toDisplay(amount: number, nativeCcy: string): number {
  const disp = state.settings.displayCcy;
  if (nativeCcy === disp) return amount;
  const USDTHB = state.fx.USDTHB || SEED_FX.USDTHB;
  if (nativeCcy === 'USD' && disp === 'THB') return amount * USDTHB;
  if (nativeCcy === 'THB' && disp === 'USD') return amount / USDTHB;
  return amount;
}

function walletToDisplay(amount: number, nativeCcy: string): number {
  const disp = state.settings.displayCcy;
  if (nativeCcy === disp) return amount;
  const USDTHB = state.fx.USDTHB || SEED_FX.USDTHB;
  const JPYTHB = state.fx.JPYTHB || SEED_FX.JPYTHB;
  const KRWTHB = state.fx.KRWTHB || SEED_FX.KRWTHB;
  let inTHB: number;
  if      (nativeCcy === 'THB') inTHB = amount;
  else if (nativeCcy === 'USD') inTHB = amount * USDTHB;
  else if (nativeCcy === 'JPY') inTHB = amount * JPYTHB;
  else if (nativeCcy === 'KRW') inTHB = amount * KRWTHB;
  else                          inTHB = amount;
  if (disp === 'THB') return inTHB;
  if (disp === 'USD') return inTHB / USDTHB;
  return inTHB;
}

function defaultFxRate(fromCcy: string, toCcy: string): number {
  if (fromCcy === toCcy) return 1;
  const USDTHB = state.fx.USDTHB || SEED_FX.USDTHB;
  const JPYTHB = state.fx.JPYTHB || SEED_FX.JPYTHB;
  const KRWTHB = state.fx.KRWTHB || SEED_FX.KRWTHB;
  function toTHB(c: string) {
    if (c === 'USD') return USDTHB;
    if (c === 'JPY') return JPYTHB;
    if (c === 'KRW') return KRWTHB;
    return 1;
  }
  function fromTHB(c: string) {
    if (c === 'USD') return 1 / USDTHB;
    if (c === 'JPY') return 1 / JPYTHB;
    if (c === 'KRW') return 1 / KRWTHB;
    return 1;
  }
  return toTHB(fromCcy) * fromTHB(toCcy);
}

// ── Lot calculations ───────────────────────────────────────────────────────────
function lotMetrics(lot: Lot) {
  const cost   = lot.price * lot.qty;
  const value  = (lot.cur != null ? lot.cur : lot.price) * lot.qty;
  const profit = value - cost;
  const pct    = cost ? (profit / cost) * 100 : 0;
  return { cost, value, profit, pct };
}

function classByKey(k: string) { return ASSET_CLASSES.find(c => c.key === k); }

// ── Aggregated positions per class ────────────────────────────────────────────
export interface Position {
  name: string; type: string | null; ccy: string;
  qty: number; cost: number; value: number;
  avgPrice: number; profit: number; pct: number;
  cur: number | undefined; sector: string; classKey: string;
  lots: (Lot & { cost: number; value: number; profit: number; pct: number })[];
}

function positions(classKey: string): Position[] {
  const cls = classByKey(classKey);
  if (!cls) return [];
  const lots = state.holdings[classKey] || [];
  const map = new Map<string, Position>();
  for (const lot of lots) {
    if (!map.has(lot.name)) {
      map.set(lot.name, { name: lot.name, type: lot.type || null, ccy: cls.ccy, qty: 0, cost: 0, value: 0, lots: [], cur: lot.cur, avgPrice: 0, profit: 0, pct: 0, sector: '', classKey });
    }
    const m = lotMetrics(lot);
    const p = map.get(lot.name)!;
    p.qty += lot.qty; p.cost += m.cost; p.value += m.value;
    p.cur = lot.cur; p.lots.push({ ...lot, ...m });
  }
  const out: Position[] = [];
  for (const p of map.values()) {
    p.avgPrice = p.qty ? p.cost / p.qty : 0;
    p.profit   = p.value - p.cost;
    p.pct      = p.cost ? (p.profit / p.cost) * 100 : 0;
    p.sector   = classKey === 'crypto' ? 'Crypto' : (state.sectors[classKey + ':' + p.name] || (p.type || '—'));
    out.push(p);
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

function classTotals(classKey: string) {
  const cls = classByKey(classKey);
  if (!cls) return null;
  let cost = 0, value = 0;
  for (const lot of (state.holdings[classKey] || [])) {
    const m = lotMetrics(lot);
    cost += m.cost; value += m.value;
  }
  const dCost  = toDisplay(cost, cls.ccy);
  const dValue = toDisplay(value, cls.ccy);
  return {
    key: classKey, label: cls.label, ccy: cls.ccy,
    color: CLASS_COLORS[classKey],
    costNative: cost, valueNative: value,
    cost: dCost, value: dValue,
    profit: dValue - dCost,
    pct: dCost ? ((dValue - dCost) / dCost) * 100 : 0,
    count: new Set((state.holdings[classKey] || []).map(l => l.name)).size,
  };
}

function grandTotals() {
  const classes = ASSET_CLASSES
    .map(c => classTotals(c.key))
    .filter((t): t is NonNullable<ReturnType<typeof classTotals>> =>
      t !== null && (t.value > 0 || (state.holdings[t.key] || []).length > 0));
  let cost = 0, value = 0;
  for (const t of classes) { cost += t.cost; value += t.value; }
  return { classes, cost, value, profit: value - cost, pct: cost ? ((value - cost) / cost) * 100 : 0 };
}

function sectorTotals() {
  const map = new Map<string, { value: number; cost: number }>();
  for (const cls of ASSET_CLASSES) {
    for (const p of positions(cls.key)) {
      const sec   = p.sector || '—';
      const v     = toDisplay(p.value, cls.ccy);
      const c     = toDisplay(p.cost, cls.ccy);
      const entry = map.get(sec) || { value: 0, cost: 0 };
      entry.value += v; entry.cost += c;
      map.set(sec, entry);
    }
  }
  return [...map.entries()]
    .map(([sector, e]) => ({ sector, value: e.value, cost: e.cost }))
    .filter(s => s.value > 0 || s.cost > 0)
    .sort((a, b) => b.value - a.value);
}

function tagTotals() {
  const map = new Map<string, { tag: Tag; value: number; cost: number }>();
  const allTags = state.tags || [];
  for (const cls of ASSET_CLASSES) {
    for (const pos of positions(cls.key)) {
      const key    = cls.key + ':' + pos.name;
      const tagIds = (state.holdingTags || {})[key] || [];
      if (!tagIds.length) continue;
      const v = toDisplay(pos.value, cls.ccy);
      const c = toDisplay(pos.cost, cls.ccy);
      for (const tagId of tagIds) {
        const tag = allTags.find(t => t.id === tagId);
        if (!tag) continue;
        const entry = map.get(tagId) || { tag, value: 0, cost: 0 };
        entry.value += v; entry.cost += c;
        map.set(tagId, entry);
      }
    }
  }
  return [...map.values()]
    .map(e => ({ ...e, profit: e.value - e.cost, pct: e.cost ? (e.value - e.cost) / e.cost * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

// ── Account balance ────────────────────────────────────────────────────────────
function _accBal(accountId: string): number {
  const acc = wallet.accounts.find(a => a.id === accountId);
  if (!acc) return 0;
  let b = acc.initialBal || 0;
  for (const t of wallet.transactions) {
    if (t.flow === 'transfer') {
      if (t.accountId === accountId) b -= t.amount;
      if (t.toAccountId === accountId) {
        const to = wallet.accounts.find(a => a.id === t.toAccountId);
        const fr = wallet.accounts.find(a => a.id === t.accountId);
        b += (to && fr && to.currency !== fr.currency && t.fxRate) ? t.amount * t.fxRate : t.amount;
      }
    } else if (t.accountId === accountId) {
      b += t.flow === 'income' ? t.amount : -t.amount;
    }
  }
  return b;
}

function _debtRemainingAmount(d: Debt): number {
  if (!d.installment) return d.amount;
  const { months, interestRate, paidMonths } = d.installment;
  const totalInterest  = d.amount * ((interestRate || 0) / 100) * (months / 12);
  const monthlyPayment = (d.amount + totalInterest) / months;
  return monthlyPayment * (months - (paidMonths || 0));
}

function _linkWalletTxn({ accountId, assetCcy, amount, flow, fxRate, note }: {
  accountId: string; assetCcy: string; amount: number;
  flow: 'income' | 'expense'; fxRate: number | null; note: string;
}) {
  if (!_walletInitialized || !accountId) return;
  const acc = wallet.accounts.find(a => a.id === accountId);
  if (!acc) return;
  const sameCcy = assetCcy === acc.currency;
  const rate    = sameCcy ? 1 : (fxRate || defaultFxRate(assetCcy, acc.currency));
  wallet.transactions.push({
    id: uid(), accountId,
    date: new Date().toISOString().slice(0, 10),
    amount: amount * rate, flow,
    categoryId: 'cat_invest_in',
    note, toAccountId: null,
    fxRate: sameCcy ? null : rate,
  });
  scheduleWalletSave();
}

// ── Snapshot ───────────────────────────────────────────────────────────────────
function grandTotalInTHB(): number {
  const rate = state.fx.USDTHB || SEED_FX.USDTHB;
  let value = 0;
  for (const cls of ASSET_CLASSES) {
    for (const lot of (state.holdings[cls.key] || [])) {
      const m = lotMetrics(lot);
      value += cls.ccy === 'USD' ? m.value * rate : m.value;
    }
  }
  return value;
}

function takeSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const value = grandTotalInTHB();
  if (value <= 0) return;
  const rate = state.fx.USDTHB || SEED_FX.USDTHB;
  const snap: Snapshot = { date: today, value };
  for (const cls of ASSET_CLASSES) {
    let v = 0;
    for (const lot of (state.holdings[cls.key] || [])) {
      const m = lotMetrics(lot);
      v += cls.ccy === 'USD' ? m.value * rate : m.value;
    }
    snap[cls.key] = v;
  }
  const idx = state.snapshots.findIndex(s => s.date === today);
  if (idx >= 0) state.snapshots[idx] = snap;
  else state.snapshots.push(snap);
  if (state.snapshots.length > MAX_SNAPSHOTS) {
    state.snapshots = state.snapshots.slice(-MAX_SNAPSHOTS);
  }
}

// ── Price refresh ──────────────────────────────────────────────────────────────
function buildApiRequest() {
  const yahoo: { key: string; name: string; symbol: string }[] = [];
  const funds: { key: string; name: string; ticker: string }[] = [];
  const crypto: { key: string; name: string; id: string }[] = [];
  for (const cls of ASSET_CLASSES) {
    if (!cls.live) continue;
    const names = [...new Set((state.holdings[cls.key] || []).map((l: Lot) => l.name))];
    for (const name of names) {
      if (cls.live === 'yahoo') {
        const symbol = cls.yahooSymbol || (name + (cls.yahooSuffix || ''));
        yahoo.push({ key: cls.key, name, symbol });
      } else if (cls.live === 'settrade') {
        funds.push({ key: cls.key, name, ticker: name });
      } else if (cls.live === 'crypto') {
        const m = CRYPTO_MAP[name];
        if (m) crypto.push({ key: cls.key, name, id: m.id });
      }
    }
  }
  return { yahoo, funds, crypto, fx: true };
}

// ── Public Store API ───────────────────────────────────────────────────────────
const Store = {
  // ── Identity ────────────────────────────────────────────────────────────────
  getPortfolioId: () => portfolioId,

  async initId(): Promise<string> {
    try {
      let id = await AsyncStorage.getItem(USER_ID_KEY);
      if (!id || !/^[a-zA-Z0-9_-]{6,64}$/.test(id)) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        await AsyncStorage.setItem(USER_ID_KEY, id);
      }
      portfolioId = id;
      return id;
    } catch {
      portfolioId = Math.random().toString(36).slice(2);
      return portfolioId;
    }
  },

  async setPortfolioId(newId: string) {
    try { await AsyncStorage.setItem(USER_ID_KEY, newId); } catch (_) {}
    portfolioId = newId;
    _initialized = false;
    _initialLoadOk = false;
    await Store.loadFromCloud(newId);
  },

  // ── Subscription ─────────────────────────────────────────────────────────────
  subscribe(fn: () => void) { subs.add(fn); return () => subs.delete(fn); },
  get: () => state,
  settings: () => state.settings,

  getDbStatus: () => ({ status: _dbStatus, savedAt: _dbSavedAt }),

  prePostPrice: (classKey: string, name: string) => state.prePostPrices[`${classKey}:${name}`] || null,
  dayChangePct(classKey: string, name: string) {
    const prevClose = (state.dayChangePrices || {})[`${classKey}:${name}`];
    if (prevClose == null || prevClose === 0) return null;
    const lot = (state.holdings[classKey] || []).find(l => l.name === name);
    if (!lot || lot.cur == null) return null;
    return ((lot.cur - prevClose) / prevClose) * 100;
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    state.settings[k] = v;
    if (k === 'hideAmounts') setHideAmounts(v as boolean);
    emit();
  },
  setSettings(obj: Partial<Settings>) {
    Object.assign(state.settings, obj);
    if (obj.hideAmounts != null) setHideAmounts(obj.hideAmounts);
    emit();
  },

  // ── Holdings mutations ────────────────────────────────────────────────────────
  addLot(classKey: string, lot: Partial<Lot> & { name: string; price: number; qty: number; sector?: string; cur?: number }, walletDeduction?: { accountId: string; exchangeRate?: number } | null) {
    state.holdings[classKey] = state.holdings[classKey] || [];
    state.holdings[classKey].push({
      id: uid(), name: lot.name, type: lot.type || undefined,
      price: +lot.price, qty: +lot.qty,
      cur: lot.cur != null ? +lot.cur : +lot.price,
    });
    if (lot.sector) state.sectors[classKey + ':' + lot.name] = lot.sector;
    if (walletDeduction?.accountId) {
      const cls = classByKey(classKey);
      _linkWalletTxn({
        accountId: walletDeduction.accountId,
        assetCcy:  cls ? cls.ccy : 'THB',
        amount:    +lot.price * +lot.qty,
        flow:      'expense',
        fxRate:    walletDeduction.exchangeRate || null,
        note:      `Buy ${lot.qty} ${lot.name}`,
      });
    }
    emit();
  },

  updateLot(classKey: string, id: string, patch: Partial<Lot> & { sector?: string }) {
    const arr = state.holdings[classKey] || [];
    const i = arr.findIndex(l => l.id === id);
    if (i < 0) return;
    const next = { ...arr[i] };
    if (patch.name  != null) next.name  = patch.name;
    if (patch.type  != null) next.type  = patch.type;
    if (patch.price != null) next.price = +patch.price;
    if (patch.qty   != null) next.qty   = +patch.qty;
    if (patch.cur   != null) next.cur   = +patch.cur;
    arr[i] = next;
    if (patch.sector != null) state.sectors[classKey + ':' + next.name] = patch.sector;
    emit();
  },

  deleteLot(classKey: string, id: string) {
    state.holdings[classKey] = (state.holdings[classKey] || []).filter(l => l.id !== id);
    emit();
  },

  setCurrentPrice(classKey: string, name: string, cur: number) {
    (state.holdings[classKey] || []).forEach(l => { if (l.name === name) l.cur = +cur; });
    emit();
  },

  setSector(classKey: string, name: string, sector: string) {
    state.sectors[classKey + ':' + name] = sector;
    emit();
  },

  resetAll() { state = freshState(); emit(); },

  // ── Sales ─────────────────────────────────────────────────────────────────────
  recordSale(classKey: string, sale: { date: string; name: string; ccy: string; buyPrice: number; sellPrice: number; qty: number }, walletCredit?: { accountId: string; exchangeRate?: number } | null) {
    const cost       = +sale.buyPrice  * +sale.qty;
    const proceeds   = +sale.sellPrice * +sale.qty;
    const realizedPnl = proceeds - cost;
    const pnlPct     = cost ? (realizedPnl / cost) * 100 : 0;
    state.sales = state.sales || [];
    state.sales.push({ id: uid(), date: sale.date, classKey, name: sale.name, ccy: sale.ccy,
      buyPrice: +sale.buyPrice, sellPrice: +sale.sellPrice, qty: +sale.qty,
      cost, proceeds, realizedPnl, pnlPct });
    if (walletCredit?.accountId) {
      _linkWalletTxn({
        accountId: walletCredit.accountId,
        assetCcy:  sale.ccy || 'THB',
        amount:    proceeds,
        flow:      'income',
        fxRate:    walletCredit.exchangeRate || null,
        note:      `Sell ${sale.qty} ${sale.name}`,
      });
    }
    emit();
  },

  deleteSale(id: string) { state.sales = (state.sales || []).filter(s => s.id !== id); emit(); },
  getSales: () => state.sales || [],
  salesSummary() {
    const sales = state.sales || [];
    const rate  = state.fx.USDTHB || SEED_FX.USDTHB;
    const map   = new Map<string, { year: string; cost: number; proceeds: number; pnl: number; count: number }>();
    for (const s of sales) {
      const year  = s.date.slice(0, 4);
      const toTHB = (v: number) => s.ccy === 'USD' ? v * rate : v;
      if (!map.has(year)) map.set(year, { year, cost: 0, proceeds: 0, pnl: 0, count: 0 });
      const y = map.get(year)!;
      y.cost += toTHB(s.cost); y.proceeds += toTHB(s.proceeds); y.pnl += toTHB(s.realizedPnl); y.count++;
    }
    return [...map.values()]
      .map(y => ({ ...y, pnlPct: y.cost ? (y.pnl / y.cost) * 100 : 0 }))
      .sort((a, b) => b.year.localeCompare(a.year));
  },

  // ── Tags ─────────────────────────────────────────────────────────────────────
  addTag(name: string, color: string) {
    const id = uid();
    state.tags = state.tags || [];
    state.tags.push({ id, name: name.trim(), color: color || '#6b7280' });
    emit();
    return id;
  },
  deleteTag(id: string) {
    state.tags = (state.tags || []).filter(t => t.id !== id);
    const ht = state.holdingTags || {};
    for (const key of Object.keys(ht)) {
      ht[key] = ht[key].filter(tid => tid !== id);
      if (!ht[key].length) delete ht[key];
    }
    emit();
  },
  updateTag(id: string, patch: Partial<Tag>) {
    const i = (state.tags || []).findIndex(t => t.id === id);
    if (i < 0) return;
    state.tags[i] = { ...state.tags[i], ...patch };
    emit();
  },
  setHoldingTags(key: string, tagIds: string[]) {
    state.holdingTags = state.holdingTags || {};
    if (!tagIds || !tagIds.length) delete state.holdingTags[key];
    else state.holdingTags[key] = tagIds;
    emit();
  },
  getTags:        () => state.tags || [],
  getHoldingTags: (key: string) => (state.holdingTags || {})[key] || [],

  // ── Read helpers ──────────────────────────────────────────────────────────────
  positions, classTotals, grandTotals, sectorTotals, tagTotals,
  classByKey, toDisplay, lotMetrics, walletToDisplay, defaultFxRate,
  getSnapshots: () => state.snapshots,
  autoSnapshot() { takeSnapshot(); emit(); },

  // ── Wallet read ───────────────────────────────────────────────────────────────
  getWallet: () => wallet,
  accountBalance: (id: string) => _accBal(id),

  monthlyFlow(year: number, month: number) {
    let income = 0, expense = 0;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    for (const t of wallet.transactions) {
      if (!t.date.startsWith(prefix)) continue;
      const acc = wallet.accounts.find(a => a.id === t.accountId);
      const ccy = acc ? acc.currency : 'THB';
      const inDisp = walletToDisplay(t.amount, ccy);
      if (t.flow === 'income')  income  += inDisp;
      if (t.flow === 'expense') expense += inDisp;
    }
    return { income, expense };
  },

  debtSummary() {
    let totalLent = 0, totalBorrowed = 0, monthlyInstallment = 0;
    for (const d of wallet.debts) {
      if (d.settled) continue;
      const inDisp = walletToDisplay(_debtRemainingAmount(d), d.currency);
      if (d.direction === 'lent')     totalLent     += inDisp;
      if (d.direction === 'borrowed') totalBorrowed += inDisp;
      if (d.installment) {
        const remaining = d.installment.months - (d.installment.paidMonths || 0);
        if (remaining > 0) {
          const ti = d.amount * ((d.installment.interestRate || 0) / 100) * (d.installment.months / 12);
          monthlyInstallment += walletToDisplay((d.amount + ti) / d.installment.months, d.currency);
        }
      }
    }
    return { totalLent, totalBorrowed, monthlyInstallment };
  },

  netWorthSummary() {
    const portValue = grandTotals().value;
    let cashTotal = 0, creditDebt = 0, borrowedDebt = 0;
    for (const acc of wallet.accounts.filter(a => !a.archived)) {
      const bal = _accBal(acc.id);
      if (acc.type === 'credit_card') {
        if (bal < 0) creditDebt += walletToDisplay(-bal, acc.currency);
      } else {
        if (bal > 0) cashTotal += walletToDisplay(bal, acc.currency);
      }
    }
    for (const d of wallet.debts) {
      if (!d.settled && d.direction === 'borrowed') {
        if (d.linkedAccountId) {
          const la = wallet.accounts.find(a => a.id === d.linkedAccountId);
          if (la && la.type === 'credit_card') continue;
        }
        borrowedDebt += walletToDisplay(_debtRemainingAmount(d), d.currency);
      }
    }
    const totalAssets      = portValue + cashTotal;
    const totalLiabilities = creditDebt + borrowedDebt;
    return { portValue, cashTotal, creditDebt, borrowedDebt, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  },

  walletMonthlyData(numMonths = 6) {
    const now = new Date();
    return Array.from({ length: numMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1 - i), 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let income = 0, expense = 0;
      for (const t of wallet.transactions) {
        if (!t.date.startsWith(prefix)) continue;
        const acc = wallet.accounts.find(a => a.id === t.accountId);
        const ccy = acc ? acc.currency : 'THB';
        const amt = walletToDisplay(t.amount, ccy);
        if (t.flow === 'income')  income  += amt;
        if (t.flow === 'expense') expense += amt;
      }
      const label = d.toLocaleString('en', { month: 'short' });
      return { month: prefix, label, income, expense };
    });
  },

  walletCategoryData(monthPrefix: string) {
    const inc: Record<string, number> = {}, exp: Record<string, number> = {};
    for (const t of wallet.transactions) {
      if (!t.date.startsWith(monthPrefix)) continue;
      if (t.flow === 'transfer') continue;
      const acc = wallet.accounts.find(a => a.id === t.accountId);
      const ccy = acc ? acc.currency : 'THB';
      const amt = walletToDisplay(t.amount, ccy);
      const cid = t.categoryId || 'uncategorized';
      if (t.flow === 'income')  inc[cid] = (inc[cid] || 0) + amt;
      if (t.flow === 'expense') exp[cid] = (exp[cid] || 0) + amt;
    }
    return { income: inc, expense: exp };
  },

  // ── Wallet mutations ──────────────────────────────────────────────────────────
  addAccount(data: Omit<WalletAccount, 'id'>) {
    wallet.accounts.push({ id: uid(), ...data });
    scheduleWalletSave(); emitOnly();
  },
  updateAccount(id: string, patch: Partial<WalletAccount>) {
    const i = wallet.accounts.findIndex(a => a.id === id);
    if (i >= 0) { wallet.accounts[i] = { ...wallet.accounts[i], ...patch }; scheduleWalletSave(); emitOnly(); }
  },
  deleteAccount(id: string) {
    wallet.accounts = wallet.accounts.filter(a => a.id !== id);
    scheduleWalletSave(); emitOnly();
  },

  addCategory(data: Omit<WalletCategory, 'id'>) {
    wallet.categories.push({ id: uid(), ...data });
    scheduleWalletSave(); emitOnly();
  },
  deleteCategory(id: string) {
    wallet.categories = wallet.categories.filter(c => c.id !== id);
    scheduleWalletSave(); emitOnly();
  },

  addTransaction(data: Omit<WalletTransaction, 'id'>) {
    wallet.transactions.push({ id: uid(), ...data });
    scheduleWalletSave(); emitOnly();
  },
  updateTransaction(id: string, patch: Partial<WalletTransaction>) {
    const i = wallet.transactions.findIndex(t => t.id === id);
    if (i >= 0) { wallet.transactions[i] = { ...wallet.transactions[i], ...patch }; scheduleWalletSave(); emitOnly(); }
  },
  deleteTransaction(id: string) {
    wallet.transactions = wallet.transactions.filter(t => t.id !== id);
    scheduleWalletSave(); emitOnly();
  },

  addDebt(data: Omit<Debt, 'id'>) {
    wallet.debts.push({ id: uid(), ...data });
    scheduleWalletSave(); emitOnly();
  },
  updateDebt(id: string, patch: Partial<Debt>) {
    const i = wallet.debts.findIndex(d => d.id === id);
    if (i >= 0) { wallet.debts[i] = { ...wallet.debts[i], ...patch }; scheduleWalletSave(); emitOnly(); }
  },
  settleDebt(id: string, settledDate: string, accountId?: string) {
    const d = wallet.debts.find(d => d.id === id);
    if (!d) return;
    d.settled = true; d.settledDate = settledDate;
    if (accountId) {
      const remaining = _debtRemainingAmount(d);
      _linkWalletTxn({
        accountId,
        assetCcy:  d.currency,
        amount:    remaining,
        flow:      d.direction === 'borrowed' ? 'expense' : 'income',
        fxRate:    null,
        note:      `Settle debt: ${d.counterparty}`,
      });
    }
    scheduleWalletSave(); emitOnly();
  },
  deleteDebt(id: string) {
    wallet.debts = wallet.debts.filter(d => d.id !== id);
    scheduleWalletSave(); emitOnly();
  },

  // ── Cloud load ────────────────────────────────────────────────────────────────
  async loadFromCloud(overrideId?: string): Promise<boolean> {
    const id = overrideId || portfolioId;
    if (!id || !/^[a-zA-Z0-9_-]{6,64}$/.test(id)) { _initialized = true; return false; }
    try {
      const r = await fetch(`${API_BASE}/api/portfolio?id=${encodeURIComponent(id)}`);
      if (!r.ok) { _initialized = true; return false; }
      const j = await r.json();
      if (!j || !j.data) { _initialized = true; _initialLoadOk = true; return false; }
      const saved = JSON.parse(j.data);
      if (!saved || typeof saved !== 'object') { _initialized = true; return false; }
      if (overrideId && overrideId !== portfolioId) {
        portfolioId = overrideId;
        try { await AsyncStorage.setItem(USER_ID_KEY, overrideId); } catch (_) {}
      }
      state = restoreFromSaved(saved);
      setHideAmounts(state.settings.hideAmounts);
      _initialized = true; _initialLoadOk = true;
      emitOnly();
      return true;
    } catch {
      _initialized = true;
      return false;
    }
  },

  async loadWalletFromCloud(): Promise<void> {
    const id = portfolioId;
    if (!id || !/^[a-zA-Z0-9_-]{6,64}$/.test(id)) { _walletInitialized = true; return; }
    try {
      const r = await fetch(`${API_BASE}/api/wallet?id=${encodeURIComponent(id)}`);
      if (!r.ok) { console.warn('[wallet] load failed:', r.status); return; }
      const j = await r.json();
      if (j && j.data) {
        const saved = JSON.parse(j.data);
        if (saved && typeof saved === 'object') {
          wallet = restoreWalletFromSaved(saved);
        }
      }
    } catch (e) {
      console.warn('[wallet] load error:', e);
      return;
    }
    _walletInitialized = true;
    emitOnly();
  },

  forceSave() { doCloudSave(); doWalletSave(); },

  // ── Live price refresh ────────────────────────────────────────────────────────
  async refreshPrices(): Promise<{ errors: string[] }> {
    try {
      const body = buildApiRequest();
      const r = await fetch(`${API_BASE}/api/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('prices endpoint failed');
      const j = await r.json();
      if (j.prices) {
        for (const k in j.prices) {
          const i   = k.indexOf(':');
          const clsKey = k.slice(0, i), name = k.slice(i + 1);
          const v   = j.prices[k];
          if (v == null || isNaN(v)) continue;
          (state.holdings[clsKey] || []).forEach(l => { if (l.name === name) l.cur = +v; });
          // day change
          if (j.prevCloses && j.prevCloses[k]) {
            state.dayChangePrices[k] = j.prevCloses[k];
          }
        }
      }
      if (j.fx) {
        state.fx = { ...state.fx, ...j.fx, at: Date.now() };
      }
      state.lastPriceSync = Date.now();
      state.priceMode = 'api';
      state.priceErrors = j.errors || [];
      emitOnly();
      return { errors: j.errors || [] };
    } catch (e) {
      state.priceErrors = [String(e)];
      state.priceMode = 'error';
      emitOnly();
      return { errors: [String(e)] };
    }
  },
};

export default Store;
