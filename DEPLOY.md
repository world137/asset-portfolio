# Portfolio Tracker — Deploy to Vercel

A single-page asset tracker. The frontend is static HTML/CSS/JS; live prices come
from one serverless function (`api/prices.js`) that ports your Google-Sheets
price formulas to the server side.

## Why a serverless function?

Your spreadsheet uses `GOOGLEFINANCE`, `THAISTOCK`, `setMutualfundInfo`,
`YAHOO_PRICE` and a CoinGecko `IMPORTDATA`. Those work in Google Sheets because
Apps Script's `UrlFetchApp.fetch` runs **on a server**. A browser can't call
Yahoo Finance or settrade.com directly — they don't send CORS headers. So those
fetches live in `api/prices.js`, which the browser calls same-origin.

| Asset class | Source (in `api/prices.js`) | Equivalent sheet formula |
|---|---|---|
| USA Stock / ETF | Yahoo chart API | `=GOOGLEFINANCE(ticker)` |
| Thai Stock | Yahoo chart API, `TICKER.BK` | `=THAISTOCK(A2)` |
| Gold | Yahoo chart API, `GC=F` | `=YAHOO_PRICE("GC=F")` |
| Thai Fund | settrade NUXT scrape (`navPerUnit`) | `=setMutualfundInfo(A2)` |
| Crypto | CoinGecko `simple/price` vs THB | `=IMPORTDATA(...coingecko...)` |
| FX (USD→THB) | Frankfurter (CoinGecko fallback) | — |

## Database — Vercel KV (free)

Portfolio data is persisted to **Vercel KV** (powered by Upstash Redis, free tier:
256 MB / 30 k daily commands). Each browser gets a random **Sync ID**; the data
is stored under that ID and refreshed every 180 days on write.

| Feature | Detail |
|---|---|
| Free tier | 256 MB storage, 30 k commands/day |
| Cross-device | Copy your Sync ID (☁ in the nav footer) and enter it on another device |
| Fallback | If KV isn't configured, the app works normally with `localStorage` only |

### Set up KV (one-time, ~2 minutes)

1. Go to **vercel.com → your project → Storage → Create Database → KV**
2. Click **Connect Project** to link the store
3. Pull env vars locally: `vercel env pull .env.local`

No code changes required — Vercel injects `KV_REST_API_URL` and
`KV_REST_API_TOKEN` automatically.

## Deploy

1. Install the CLI: `npm i -g vercel`
2. From this folder: `vercel` (first run links/creates the project), then
   `vercel --prod` to ship.
   — or — push the folder to a Git repo and "Import Project" on vercel.com.
3. After first deploy, add the KV store (see above). No build step needed —
   Vercel auto-detects the `api/` folder.

That's it. Open the deployed URL and click **Refresh** in the top bar — every
asset class updates live. Your holdings auto-save to the cloud within 2 seconds
of any change.

## Running locally with live prices

Static file servers (and this preview) can't run the function, so stocks / funds
/ gold stay on your saved prices (crypto + FX still update directly). To run the
function locally:

```
vercel dev
```

Then open the printed `localhost` URL — the API works exactly as in production.

## Stock Scanner in production

Vercel can't run the Go `stock-scanner` (no Go toolchain, and a full scan takes
~4 minutes), so host it separately and let the app read its results:

1. Deploy the `stock-scanner` repo's Docker image to any container host
   (Fly.io, Render, Railway, Cloud Run, a VPS…). It runs `serve`, scans on
   startup and re-scans hourly, and serves the latest result at
   `GET /api/v1/scan`. Set `SCANNER_API_TOKEN` on the container so the API
   requires a bearer token. Give it a persistent volume for `/app/data` if you
   want the universe cache to survive restarts.
2. In the Vercel project add env vars, then redeploy:
   - `SCANNER_URL` — e.g. `https://stock-scanner.example.com` (no trailing path)
   - `SCANNER_API_TOKEN` — same token as the container
3. Open **Stock Scanner** — it loads the latest scan automatically; the button
   becomes "Refresh results". The first scan after a container start takes a few
   minutes (the page shows "still running its first scan" until then).

Without `SCANNER_URL`, the page falls back to local mode (`vercel dev` next to
the `stock-scanner` folder, button runs `run-scan.sh --all`).

## Notes / limits

- Data is stored per-browser in `localStorage` (no account, no cross-device sync).
  Use **Export** to back up / move between devices (if enabled).
- Yahoo / settrade are unofficial endpoints; if either changes its markup the
  corresponding price may stop resolving. The app degrades gracefully and you can
  always click a price to set it manually.
- Manual current-price edits are overwritten the next time a live refresh
  succeeds for that asset.
