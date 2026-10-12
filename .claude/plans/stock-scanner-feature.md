# Plan: Stock Scanner feature

**Goal:** A "Scanner" page in asset-portfolio with a button that runs
`stock-scanner/scripts/run-scan.sh --all` (local dev only) and renders the
returned candidates in a table.

## Context / constraints
- asset-portfolio is deployed on Vercel (serverless, ephemeral FS, no Go
  toolchain in production) — this feature can only work when running
  locally (`vercel dev` or `node dev-server.mjs`), both of which have a real
  filesystem and can shell out to a sibling project directory.
- The real script lives at `stock-scanner/scripts/run-scan.sh` (not
  `./run-scan.sh` at the repo root as mentioned) — `--all` is a passthrough
  flag it forwards to the `scan` subcommand.
- In production, the endpoint must fail gracefully (same pattern as
  `api/watchlist.js`'s "supabase-not-configured" fallback) rather than crash.

## Steps
- [x] Add `api/scanner.js`: POST handler that resolves the stock-scanner dir
      (env `STOCK_SCANNER_DIR`, default `../stock-scanner` sibling path),
      verifies `scripts/run-scan.sh` exists, runs it with `--all` via
      `child_process.execFile('bash', [...])` with a generous timeout,
      then reads back `results/latest.json` and returns it. Returns a
      `{ error: 'scanner-unavailable' }` style response if the directory/
      script isn't present instead of throwing.
- [x] Add `api/scanner.js` entry to `vercel.json` functions block with a
      long `maxDuration`.
- [x] Add `src/components/ScannerView.jsx`: "Run scan (--all)" button +
      loading state + results table (symbol, score, rating, pullback %,
      EMA touch, RSI, VP signal) + empty/error states, following
      WatchlistView's structure/styling conventions.
- [x] Wire into `src/app.jsx`: nav item, title mapping, route render block.
- [x] Add `<script type="text/babel" src="src/components/ScannerView.jsx">`
      to `index.html` in the right load order.
- [ ] Manually verify: run `node dev-server.mjs` (or `vercel dev`) in
      asset-portfolio, click the button, confirm it shells out to
      stock-scanner and renders real candidates.

## Notes
(decisions/discoveries go here as I go)
