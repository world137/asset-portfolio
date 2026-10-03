// Local dev server: serves static files and runs api/*.js handlers (Vercel-style).
// Database = local PostgREST (see docker-compose.yml). Usage: node dev-server.mjs
import http from 'http';
import { readFile, stat } from 'fs/promises';
import { createHmac } from 'crypto';
import { extname, join, normalize } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'postgres' })}`;
const jwt = `${unsigned}.${createHmac('sha256', 'local-dev-secret-local-dev-secret-123').update(unsigned).digest('base64url')}`;
const REST = process.env.LOCAL_REST_URL || 'http://localhost:3001';
// api/*.js call `${SUPABASE_URL}/rest/v1/...`; we proxy /rest/v1/* to PostgREST below.
process.env.SUPABASE_URL = `http://localhost:${PORT}`;
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY = jwt;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function wrap(res) {
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  res.send = b => { res.end(typeof b === 'object' && !Buffer.isBuffer(b) ? JSON.stringify(b) : b); return res; };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/rest/v1/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await fetch(REST + url.pathname.slice(8) + url.search, {
        method: req.method, body,
        headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'connection', 'content-length'].includes(k))),
      });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' });
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/\/$/, '');
      if (!/^[a-z0-9-]+$/i.test(name) || name.startsWith('_')) { res.statusCode = 404; return res.end('not found'); }
      req.query = Object.fromEntries(url.searchParams);
      let mod;
      try { mod = await import(pathToFileURL(join(ROOT, 'api', `${name}.js`)).href + `?t=${Date.now()}`); }
      catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') { res.statusCode = 404; return res.end('not found'); } throw e; }
      return await mod.default(req, wrap(res));
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(ROOT, p);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file).catch(() => null);
    if (!data) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e.message) }));
  }
}).listen(PORT, () => console.log(`Local app → http://localhost:${PORT}  (login: demo / demo)`));
