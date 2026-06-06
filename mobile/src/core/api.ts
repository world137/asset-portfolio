// api.ts — Vercel endpoint wrappers used by screens directly (non-store calls)
import { API_BASE } from './constants';

export async function apiAuth(username: string, passwordHash: string): Promise<{ ok: boolean; portfolioId?: string; error?: string }> {
  const r = await fetch(`${API_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash }),
  });
  return r.json();
}

export interface ChartPoint { t: number; o: number; h: number; l: number; c: number; }
export interface ChartData {
  symbol: string; currency: string; price: number; prevClose: number;
  points: ChartPoint[];
}

export async function apiChart(symbol: string, range = '1mo'): Promise<ChartData | null> {
  try {
    const r = await fetch(`${API_BASE}/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export interface MacroData {
  indicators: Record<string, number | null>;
  impactMatrix: unknown[];
}

export async function apiMacro(): Promise<MacroData | null> {
  try {
    const r = await fetch(`${API_BASE}/api/macro`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export interface BondEntry {
  key: string; label: string; flag: string;
  value: number; change: number; changePct: number;
}

export async function apiBonds(): Promise<{ bonds: BondEntry[] } | null> {
  try {
    const r = await fetch(`${API_BASE}/api/bonds`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export interface TechnicalData {
  symbol: string;
  ema: { ema20: number[]; ema50: number[]; ema200: number[] };
  rsi: number[];
  macd: { macd: number[]; signal: number[]; histogram: number[] };
  bollinger: { upper: number[]; middle: number[]; lower: number[] };
  candles: ChartPoint[];
  dates: string[];
}

export async function apiTechnical(symbol: string): Promise<TechnicalData | null> {
  try {
    const r = await fetch(`${API_BASE}/api/technical?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export interface WatchlistItem { ticker: string; type: string; name?: string; }

export async function apiGetWatchlist(id: string): Promise<WatchlistItem[]> {
  try {
    const r = await fetch(`${API_BASE}/api/watchlist?id=${encodeURIComponent(id)}`);
    if (!r.ok) return [];
    const j = await r.json();
    return j.items || [];
  } catch { return []; }
}

export async function apiSaveWatchlist(id: string, items: WatchlistItem[]): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, items }),
    });
    return r.ok;
  } catch { return false; }
}

// Simple SHA-256 hash for password (same as web: hex string)
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
