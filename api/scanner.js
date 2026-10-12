/* ============================================================================
   api/scanner.js — Vercel Serverless Function (local dev only)

   Shells out to the sibling `stock-scanner` Go project and runs its
   `scripts/run-scan.sh --all` wrapper, then returns the resulting
   results/latest.json. This only works where a real filesystem + bash +
   Go toolchain are available (i.e. `vercel dev` / `node dev-server.mjs`
   on your own machine) — it cannot work on deployed Vercel production,
   which has no sibling project directory and no Go toolchain. In that
   case this handler returns a `scanner-unavailable` error instead of
   crashing, same as api/watchlist.js falls back when Supabase isn't
   configured.

   POST /api/scanner   body: { all?: true, index?: 'sp500'|'nasdaq100'|'set50', top?: number }
     → { ok: true, result: <results/latest.json>, log: <script stdout tail> }
   ============================================================================ */

import { access } from 'fs/promises';
import { join, resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readBody } from './_lib.js';

const execFileAsync = promisify(execFile);

const SCANNER_DIR = resolve(process.env.STOCK_SCANNER_DIR || join(process.cwd(), '..', 'stock-scanner'));
const RUN_SCRIPT = join(SCANNER_DIR, 'scripts', 'run-scan.sh');
const TIMEOUT_MS = 10 * 60 * 1000; // scanning ~600+ symbols can take a while

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).end();

  if (!(await scannerAvailable())) {
    return res.status(200).json({
      ok: false,
      error: 'scanner-unavailable',
      message: `stock-scanner not found at ${SCANNER_DIR} (local dev only — not available in production).`,
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
