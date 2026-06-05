#!/usr/bin/env node
// Register (or update) a user in the Supabase users table.
//
// Usage:
//   node tools/register-user.mjs <username> <password> [portfolioId]
//
// If portfolioId is omitted it defaults to sha256(password).slice(0, 32),
// which matches the existing convention used by the app.
//
// Requirements:
//   - .env.local must have SUPABASE_URL and SUPABASE_SERVICE_KEY
//   - You must have already run database/auth_migration.sql in Supabase

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  try {
    return Object.fromEntries(
      readFileSync(resolve(ROOT, '.env.local'), 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
    );
  } catch (_) { return {}; }
}

const env = loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;

const [,, username, password, portfolioIdArg] = process.argv;
if (!username || !password) {
  console.error('Usage: node tools/register-user.mjs <username> <password> [portfolioId]');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const passwordHash = createHash('sha256').update(password).digest('hex');
const portfolioId  = portfolioIdArg || passwordHash.slice(0, 32);
const uname        = username.trim().toLowerCase();
const now          = new Date().toISOString();

const headers = {
  apikey:        SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:        'resolution=merge-duplicates,return=minimal',
};

const r = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify([{
    id:            portfolioId,
    username:      uname,
    password_hash: passwordHash,
    created_at:    now,
    updated_at:    now,
  }]),
});

if (!r.ok) {
  console.error('✗ Supabase error', r.status, await r.text().catch(() => ''));
  process.exit(1);
}

console.log('✓ User registered');
console.log('  username:     ', uname);
console.log('  portfolio ID: ', portfolioId);
console.log('  password hash:', passwordHash);
