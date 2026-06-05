#!/usr/bin/env node
// One-time migration: moves all database rows from the old btoa-based portfolio ID
// to the new SHA-256-based one after upgrading Login.jsx.
//
// Usage: node tools/migrate-portfolio-id.mjs <old-password> [new-password]
// If new-password is omitted, the same password is used (common case: just re-hashing).
//
// Requires SUPABASE_URL and SUPABASE_KEY in .env.local (service_role key recommended).

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// --- Load env ---
const envPath = resolve(process.cwd(), '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); const v = l.slice(i + 1).trim(); return [l.slice(0, i).trim(), v.replace(/^["']|["']$/g, '')]; })
);
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

// --- Parse args ---
const oldPw = process.argv[2];
const newPw = process.argv[3] ?? oldPw;
if (!oldPw) {
  console.error('Usage: node tools/migrate-portfolio-id.mjs <old-password> [new-password]');
  process.exit(1);
}

// Old ID: btoa-based (the scheme used before this security upgrade)
const oldId = Buffer.from('ptf:' + oldPw).toString('base64')
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .slice(0, 32);

// New ID: SHA-256-based (first 32 hex chars)
const newId = createHash('sha256').update(newPw).digest('hex').slice(0, 32);

console.log(`Old portfolio ID : ${oldId}`);
console.log(`New portfolio ID : ${newId}`);
if (oldId === newId) { console.log('IDs are identical — nothing to migrate.'); process.exit(0); }

// --- Supabase REST helper ---
async function sb(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`GET ${path} → ${res.status}: ${t}`); }
  return res.json();
}

// --- Run migration ---
const [existing, oldUsers] = await Promise.all([
  sbGet(`/users?id=eq.${newId}&select=id`),
  sbGet(`/users?id=eq.${oldId}&select=id,created_at`),
]);

if (oldUsers.length === 0) {
  console.error(`\nOld user ${oldId} not found in database. Nothing to migrate.`);
  process.exit(1);
}

if (existing.length > 0) {
  // New user already exists — check if it was auto-created empty (no holdings)
  const newHoldings = await sbGet(`/holdings?user_id=eq.${newId}&select=id&limit=1`);
  if (newHoldings.length > 0) {
    console.log('\nNew ID already has data — migration already done.');
    process.exit(0);
  }
  console.log('\nNew ID exists but is empty — cleaning it up and re-migrating from old ID…');
  await sb('DELETE', `/users?id=eq.${newId}`);
  console.log('  ✓ Removed empty new user row');
}

console.log('\nStarting migration…');

// 1. Create the new user row
await sb('POST', '/users', { id: newId, created_at: oldUsers[0].created_at });
console.log('  ✓ Created new user row');

// 2. Re-point all child tables to the new ID
const tables = [
  ['settings',            'user_id'],
  ['holdings',            'user_id'],
  ['sectors',             'user_id'],
  ['snapshots',           'user_id'],
  ['fx_rates',            'user_id'],
  ['sales',               'user_id'],
  ['wallet_accounts',     'user_id'],
  ['wallet_categories',   'user_id'],
  ['wallet_transactions', 'user_id'],
  ['wallet_debts',        'user_id'],
  ['market_prices',       'user_id'],
  ['price_history',       'user_id'],
  ['debt_payments',       'user_id'],
  ['asset_tags',          'user_id'],
  ['holding_tags',        'user_id'],
  ['watchlist',           'portfolio_id'],
];

for (const [table, col] of tables) {
  await sb('PATCH', `/${table}?${col}=eq.${oldId}`, { [col]: newId });
  console.log(`  ✓ Updated ${table}`);
}

// 3. Delete the old user row (children already re-pointed; cascade deletes nothing)
await sb('DELETE', `/users?id=eq.${oldId}`);
console.log('  ✓ Removed old user row');

console.log(`\nDone. Portfolio is now keyed by: ${newId}`);
