# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local development with live prices and serverless functions
vercel dev

# Deploy to production
vercel --prod

# Restore holdings data from CSV backup
node restore.mjs

# Pull environment variables from Vercel
vercel env pull .env.local
```

There is no build step, test suite, or linter. The frontend runs entirely in the browser via Babel standalone transpilation.

## Architecture

This is a **single-page asset portfolio tracker** for Thai investors. It has no build pipeline — `index.html` loads React 18 and Babel from CDN and transpiles JSX at runtime. The backend is Vercel Serverless Functions in `api/`.

### Data storage

All data is persisted in Supabase (PostgreSQL) and keyed by a `portfolioId`. There is no user authentication — knowing the portfolio ID grants full access. The ID is derived from a password hash

Tables: `users`, `settings`, `holdings`, `sectors`, `snapshots`, `sales`, `fx_rates`, `wallets`.

### State management (`src/store.js`)

A singleton pub/sub store (~1000 lines). It holds all runtime state: holdings, sectors, FX rates, snapshots, sales, wallet data, and settings. It computes derived values (total value in THB, P/L, allocation percentages) and auto-saves to Supabase 500ms after any mutation.

### Price fetching (`api/prices.js`)

`POST /api/prices` accepts a list of tickers and dispatches to:
- **Thai stocks**: settrade (unofficial endpoint)
- **US stocks / ETFs / funds**: Yahoo Finance (unofficial endpoint)
- **Crypto**: CoinGecko
- **FX rates**: Frankfurter API

The serverless function exists primarily to work around browser CORS restrictions on Yahoo/settrade. Prices refresh every 12 hours or on demand.

### Asset classes

Defined in `src/constants.js`: `thaiStock`, `usaStock`, `etf`, `fund`, `crypto`, `gold`, `other`. Each has a native currency (THB or USD), a price source, and a color. All values are converted to THB for display using live FX rates.

### Wallet module (`src/components/wallet/`)

A sub-system tracking cash accounts, transactions, debts (with installment schedules), and net worth (portfolio value + cash − liabilities). Uses a separate API endpoint `api/wallet.js`.

### Routing

Entirely client-side state in `app.jsx`. No URL-based routing — the current view is tracked in React state. Views: Dashboard, Net Worth, per-class Holdings (7 types), Analysis (sector/cost breakdown, sell log), Wallet (accounts, transactions, debts, calendar).

### Environment variables

Stored in `.env.local` (pulled from Vercel). Required: `SUPABASE_URL`, `SUPABASE_KEY`. The API functions access Supabase via its REST API using `fetch` directly — no npm dependencies in `api/`.
