/* ============================================================================
   api/scanner.js — Vercel Serverless Function

   Vercel can't run the Go stock-scanner, so production works by *publishing*:
   you run stock-scanner/scripts/publish-scan.sh on your own machine (or cron),
   which runs `run-scan.sh --all` and POSTs results/latest.json here; it is
   stored in Supabase (`scanner_results`, see database/scanner_results_migration.sql)
   and the Scanner page reads it back.

   GET  /api/scanner → { ok, mode, result }   latest scan, never runs one
        local dev (stock-scanner folder present) → results/latest.json
        production → latest published scan from Supabase
   POST /api/scanner
        Authorization: Bearer <SCANNER_PUSH_TOKEN>, body { result: <latest.json> }
          → stores it as the latest scan (what publish-scan.sh sends)
        otherwise (local dev only): body { all?, index?, top?, minScore? } runs
          `run-scan.sh` and returns the result
   ============================================================================ */

import { access } from 'fs/promises';
import { join, resolve } from 'path';
import { timingSafeEqual } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readBody } from './_lib.js';

const execFileAsync = promisify(execFile);

const SCANNER_DIR = resolve(process.env.STOCK_SCANNER_DIR || join(process.cwd(), '..', 'stock-scanner'));
const RUN_SCRIPT = join(SCANNER_DIR, 'scripts', 'run-scan.sh');
const TIMEOUT_MS = 10 * 60 * 1000; // scanning ~600+ symbols can take a while
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PUSH_TOKEN = process.env.SCANNER_PUSH_TOKEN || '';

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

function tokenOk(req) {
  const got = String(req.headers?.authorization || '');
  const want = `Bearer ${PUSH_TOKEN}`;
  if (!PUSH_TOKEN || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function readPublished(res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ ok: false, mode: 'unavailable', error: 'scanner-unavailable',
      message: 'Scanner is not configured. Publish results with stock-scanner/scripts/publish-scan.sh (see DEPLOY.md), or run locally next to the stock-scanner project.' });
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/scanner_results?id=eq.latest&select=result,updated_at`, { headers: sbHeaders() });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
    const rows = await r.json();
    if (!rows.length) {
      return res.status(200).json({ ok: false, mode: 'published', error: 'no-results',
        message: 'No scan has been published yet. Run stock-scanner/scripts/publish-scan.sh.' });
    }
    return res.status(200).json({ ok: true, mode: 'published', result: rows[0].result, publishedAt: rows[0].updated_at });
  } catch (e) {
    return res.status(200).json({ ok: false, mode: 'published', error: 'scanner-error', message: `Could not load published scan: ${e.message}` });
  }
}

async function publish(req, res) {
  if (!PUSH_TOKEN) return res.status(503).json({ ok: false, error: 'publish-disabled', message: 'SCANNER_PUSH_TOKEN is not set on the server.' });
  if (!tokenOk(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: 'supabase-not-configured' });
  let body = {};
  try { body = await readBody(req); } catch { body = {}; }
  const result = body.result;
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates)) {
    return res.status(400).json({ ok: false, error: 'bad-result', message: 'Body must be { result: <latest.json> } with a candidates array.' });
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/scanner_results`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ id: 'latest', result, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) return res.status(500).json({ ok: false, error: 'save-failed', message: (await r.text().catch(() => '')).slice(0, 200) });
  return res.status(200).json({ ok: true, candidates: result.candidates.length });
}

async function scannerAvailable() {
  try { await access(RUN_SCRIPT); return true; } catch { return false; }
}

function buildArgs(body) {
  const args = [];
  if (body.all) args.push('--all');
  if (body.index) args.push('--index', String(body.index).slice(0, 20));
  if (body.top != null && Number.isFinite(Number(body.top))) args.push('--top', String(Math.max(1, Math.min(50, Number(body.top)))));
  if (body.minScore != null && Number.isFinite(Number(body.minScore))) args.push('--min-score', String(Number(body.minScore)));
  return args.length ? args : ['--all'];
}

async function readLatestLocal(res) {
  try {
    const { readFile } = await import('fs/promises');
    const result = JSON.parse(await readFile(join(SCANNER_DIR, 'results', 'latest.json'), 'utf8'));
    return res.status(200).json({ ok: true, mode: 'local', result });
  } catch {
    return res.status(200).json({ ok: false, mode: 'local', error: 'no-results', message: 'No scan results yet — run a scan.' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  const local = await scannerAvailable();
  if (req.method === 'GET') return local ? readLatestLocal(res) : readPublished(res);
  if (String(req.headers?.authorization || '').startsWith('Bearer ')) return publish(req, res);

  if (!local) {
    return res.status(200).json({
      ok: false,
      error: 'scanner-unavailable',
      mode: 'unavailable',
      message: `Scanner not configured: stock-scanner not found at ${SCANNER_DIR}. In production, results are published with stock-scanner/scripts/publish-scan.sh (see DEPLOY.md).`,
    });
  }

  let body = {};
  try { body = await readBody(req); } catch { body = {}; }

  const args = buildArgs(body);

  try {
    const { stdout, stderr } = await execFileAsync('bash', [RUN_SCRIPT, ...args], {
      cwd: SCANNER_DIR,
      timeout: TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });

    const { readFile } = await import('fs/promises');
    const resultPath = join(SCANNER_DIR, 'results', 'latest.json');
    const result = JSON.parse(await readFile(resultPath, 'utf8'));

    return res.status(200).json({
      ok: true,
      mode: 'local',
      result,
      log: (stdout || stderr || '').split('\n').slice(-40).join('\n'),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'scan-failed',
      message: e.message,
      log: (e.stdout || e.stderr || '').toString().split('\n').slice(-40).join('\n'),
    });
  }
}
