/**
 * recover.mjs — Restore portfolio from backup folder + CSV holdings snapshot.
 *
 * What it does:
 *   1. Reads holdings from database/holdings_rows.csv  (last good state)
 *   2. Reads sectors / tags / holdingTags / settings / snapshots / sales / fx
 *      from portfolio-backup-2026-06-04/portfolio.json
 *   3. Reads wallet data from portfolio-backup-2026-06-04/wallet.json
 *   4. POSTs everything to /api/data-transfer (mode=override) via a running
 *      local dev server (vercel dev).
 *
 * Run:
 *   vercel dev          ← start server first (port 3000)
 *   node recover.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// ── 1. Read source files ──────────────────────────────────────────────────────

const meta      = JSON.parse(readFileSync(resolve(ROOT, 'portfolio-backup-2026-06-04/meta.json'), 'utf8'));
const portfolio = JSON.parse(readFileSync(resolve(ROOT, 'portfolio-backup-2026-06-04/portfolio.json'), 'utf8'));
const wallet    = JSON.parse(readFileSync(resolve(ROOT, 'portfolio-backup-2026-06-04/wallet.json'), 'utf8'));
const csvRaw    = readFileSync(resolve(ROOT, 'database/holdings_rows.csv'), 'utf8');

const userId = meta.userId;

// ── 2. Parse holdings from CSV ────────────────────────────────────────────────
// Format: id,user_id,class_key,name,type,price,qty,cur,created_at

const csvLines = csvRaw.trim().split('\n');
const headers  = csvLines[0].split(',').map(h => h.trim());

const idxOf = (col) => headers.indexOf(col);
const COL = {
  id:        idxOf('id'),
  classKey:  idxOf('class_key'),
  name:      idxOf('name'),
  type:      idxOf('type'),
  price:     idxOf('price'),
  qty:       idxOf('qty'),
  cur:       idxOf('cur'),
};

const holdings = {};
for (let i = 1; i < csvLines.length; i++) {
  const parts    = csvLines[i].split(',');
  const classKey = parts[COL.classKey];
  const name     = parts[COL.name];
  const type     = parts[COL.type] || null;
  const price    = parseFloat(parts[COL.price]);
  const qty      = parseFloat(parts[COL.qty]);
  const curRaw   = parts[COL.cur];
  const cur      = curRaw ? parseFloat(curRaw) : null;
  const id       = parts[COL.id];

  if (!classKey || !name || isNaN(price) || isNaN(qty)) {
    console.warn(`  Skipping malformed CSV row ${i}: ${csvLines[i]}`);
    continue;
  }

  (holdings[classKey] ||= []).push({ id, name, type, price, qty, cur });
}

// ── 3. Merge: use CSV holdings, keep everything else from portfolio.json ───────

const mergedPortfolio = {
  ...portfolio,
  holdings,  // replace the empty {} with real CSV data
};

// ── 4. Summary ────────────────────────────────────────────────────────────────

const holdingTotal = Object.values(holdings).reduce((s, arr) => s + arr.length, 0);
const classBreakdown = Object.entries(holdings)
  .map(([k, v]) => `${k}:${v.length}`)
  .join('  ');

console.log('─────────────────────────────────────────────');
console.log(`User ID   : ${userId}`);
console.log(`Holdings  : ${holdingTotal}  (${classBreakdown})`);
console.log(`Sectors   : ${Object.keys(mergedPortfolio.sectors || {}).length}`);
console.log(`Tags      : ${(mergedPortfolio.tags || []).length}`);
console.log(`Snapshots : ${(mergedPortfolio.snapshots || []).length}`);
console.log(`Sales     : ${(mergedPortfolio.sales || []).length}`);
console.log(`Wallet    : ${(wallet.accounts || []).length} accounts  ${(wallet.transactions || []).length} txns  ${(wallet.debts || []).length} debts`);
console.log('─────────────────────────────────────────────');
console.log('Sending to /api/data-transfer (mode=override)…');

// ── 5. POST to data-transfer API ──────────────────────────────────────────────

const API = 'http://localhost:3000/api/data-transfer';

let resp;
try {
  resp = await fetch(API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id: userId, mode: 'override', portfolio: mergedPortfolio, wallet }),
  });
} catch (e) {
  console.error('\n✗  Could not reach the server.');
  console.error('   Make sure `vercel dev` is running on port 3000, then re-run this script.');
  process.exit(1);
}

const json = await resp.json().catch(() => ({}));

if (resp.ok && json.ok) {
  console.log('\n✓  Data restored successfully!');
  console.log('   Refresh the app in your browser to see your portfolio.');
} else {
  console.error(`\n✗  Restore failed (HTTP ${resp.status}):`, json.error || json.detail || JSON.stringify(json));
  process.exit(1);
}
