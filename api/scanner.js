/* ============================================================================
   api/scanner.js — Vercel Serverless Function

   Two modes:
   • remote (production): set SCANNER_URL to a hosted stock-scanner container
     (its `serve` mode, see stock-scanner/Dockerfile) and, if the container
     has SCANNER_API_TOKEN set, the same token here. The function proxies
     GET {SCANNER_URL}/api/v1/scan, which returns the latest completed scan
     (the container re-scans on its own schedule). Vercel itself has no Go
     toolchain and a 4-minute scan would exceed function limits.
   • local (dev): without SCANNER_URL, POST shells out to the sibling
     `stock-scanner/scripts/run-scan.sh --all` (needs `vercel dev` /
     `node dev-server.mjs` on a machine with Go).

   GET  /api/scanner → { ok, mode, result }   latest scan, never runs one
   POST /api/scanner → remote: same as GET; local: runs a scan first
     body (local only): { all?: true, index?, top?, minScore? }
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
const REMOTE_URL = (process.env.SCANNER_URL || '').replace(/\/+$/, '');
const REMOTE_TOKEN = process.env.SCANNER_API_TOKEN || '';

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

async function fetchRemote(res) {
  try {
    const r = await fetch(`${REMOTE_URL}/api/v1/scan`, {
      headers: REMOTE_TOKEN ? { Authorization: `Bearer ${REMOTE_TOKEN}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 503) {
      return res.status(200).json({ ok: false, mode: 'remote', error: 'scan-pending',
        message: 'The scanner is still running its first scan — try again in a few minutes.' });
    }
    if (!r.ok) {
      return res.status(200).json({ ok: false, mode: 'remote', error: 'scanner-error',
        message: `Scanner service returned HTTP ${r.status}${r.status === 401 ? ' (check SCANNER_API_TOKEN)' : ''}.` });
    }
    return res.status(200).json({ ok: true, mode: 'remote', result: await r.json() });
  } catch (e) {
    return res.status(200).json({ ok: false, mode: 'remote', error: 'scanner-unreachable',
      message: `Could not reach the scanner service: ${e.message}` });
  }
}

async function readLatestLocal(res) {
  if (!(await scannerAvailable())) {
    return res.status(200).json({ ok: false, mode: 'unavailable', error: 'scanner-unavailable',
      message: 'Scanner is not configured. Set SCANNER_URL to a hosted stock-scanner service (see DEPLOY.md), or run locally next to the stock-scanner project.' });
  }
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

  if (REMOTE_URL) return fetchRemote(res);
  if (req.method === 'GET') return readLatestLocal(res);

  if (!(await scannerAvailable())) {
    return res.status(200).json({
      ok: false,
      error: 'scanner-unavailable',
      mode: 'unavailable',
      message: `Scanner not configured: stock-scanner not found at ${SCANNER_DIR}. In production set SCANNER_URL to a hosted stock-scanner service (see DEPLOY.md).`,
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
