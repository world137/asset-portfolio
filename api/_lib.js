/* api/_lib.js — shared helpers for Vercel serverless functions */

/**
 * Parse request body regardless of how Vercel delivers it
 * (pre-parsed object, raw string, or streaming).
 */
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) {}
  }
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => {
      try { resolve(JSON.parse(d || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}
