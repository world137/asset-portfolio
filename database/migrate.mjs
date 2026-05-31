/**
 * database/migrate.mjs
 * Restores portfolio data from the CSV backups in database/ directly to Supabase.
 *
 * Usage:
 *   node database/migrate.mjs
 *
 * Requirements:
 *   - .env.local must have SUPABASE_URL and SUPABASE_SERVICE_KEY
 *   - Run from the project root OR the database/ directory
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const DB_DIR    = __dirname;

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
        .map(l => {
          const i = l.indexOf('=');
          const val = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
          return [l.slice(0, i).trim(), val];
        })
    );
  } catch (_) {
    return {};
  }
}

const env = loadEnv(resolve(ROOT, '.env.local'));
const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sbUpsert(table, rows) {
  if (!rows.length) return 0;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`upsert ${table} failed ${r.status}: ${body}`);
  }
  return rows.length;
}

// ── CSV parser (simple — no embedded commas in these CSVs) ───────────────────

function parseCSV(filename) {
  const text = readFileSync(resolve(DB_DIR, filename), 'utf8').trim();
  const lines = text.split('\n');
  if (lines.length < 2) return []; // header-only file
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]));
  });
}

// ── Restore steps ─────────────────────────────────────────────────────────────

const now = new Date().toISOString();

// 1. Users
{
  const rows = parseCSV('users_rows.csv');
  const n = await sbUpsert('users', rows.map(r => ({
    id:         r.id,
    created_at: r.created_at || now,
    updated_at: r.updated_at || now,
  })));
  console.log(`✓ users          ${n} row(s)`);
}

// 2. Settings
{
  const rows = parseCSV('settings_rows.csv');
  const n = await sbUpsert('settings', rows.map(r => ({
    user_id:     r.user_id,
    display_ccy: r.display_ccy || 'THB',
    theme:       r.theme       || 'light',
    chart_style: r.chart_style || 'donut',
    palette:     r.palette     || 'class',
    layout:      r.layout      || 'overview',
    decimals:    parseInt(r.decimals) || 2,
    updated_at:  r.updated_at  || now,
  })));
  console.log(`✓ settings        ${n} row(s)`);
}

// 3. Holdings
{
  const rows = parseCSV('holdings_rows.csv');
  const n = await sbUpsert('holdings', rows.map(r => ({
    id:        r.id,
    user_id:   r.user_id,
    class_key: r.class_key,
    name:      r.name,
    type:      r.type || null,
    price:     parseFloat(r.price),
    qty:       parseFloat(r.qty),
    cur:       r.cur ? parseFloat(r.cur) : null,
  })));
  console.log(`✓ holdings        ${n} row(s)`);

  // 4. market_prices — deduplicate by (class_key, name), keep the first cur seen
  const mpMap = new Map();
  for (const r of rows) {
    const key = `${r.class_key}:${r.name}`;
    if (r.cur && !mpMap.has(key)) {
      mpMap.set(key, {
        user_id:      r.user_id,
        class_key:    r.class_key,
        name:         r.name,
        price:        parseFloat(r.cur),
        source:       'migrated',
        refreshed_at: now,
      });
    }
  }
  const mn = await sbUpsert('market_prices', [...mpMap.values()]);
  console.log(`✓ market_prices   ${mn} row(s)  (seeded from holdings.cur)`);
}

// 5. Sectors
{
  const rows = parseCSV('sectors_rows.csv');
  const n = await sbUpsert('sectors', rows.map(r => ({
    user_id:   r.user_id,
    class_key: r.class_key,
    name:      r.name,
    sector:    r.sector,
  })));
  console.log(`✓ sectors         ${n} row(s)`);
}

// 6. FX rates
{
  const rows = parseCSV('fx_rates_rows.csv');
  const n = await sbUpsert('fx_rates', rows.map(r => ({
    user_id:     r.user_id,
    pair:        r.pair,
    rate:        parseFloat(r.rate),
    recorded_at: r.recorded_at || now,
  })));
  console.log(`✓ fx_rates        ${n} row(s)`);
}

// 7. Snapshots
{
  const rows = parseCSV('snapshots_rows.csv');
  const n = await sbUpsert('snapshots', rows.map(r => ({
    user_id: r.user_id,
    date:    r.date,
    value:   parseFloat(r.value),
  })));
  console.log(`✓ snapshots       ${n} row(s)`);
}

console.log('\n✓ Migration complete — refresh the app to see your portfolio.');
