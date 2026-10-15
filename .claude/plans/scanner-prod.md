# Plan: Make Stock Scanner work in production

**Goal:** Deployed (Vercel) app shows real scanner results by proxying to a hosted stock-scanner container; local dev keeps shelling out to run-scan.sh.

## Steps
- [x] api/scanner.js: remote mode (published via publish-scan.sh -> Supabase scanner_results) proxying GET /api/v1/scan; add GET handler (latest results, never runs a scan)
- [x] ScannerView.jsx: load latest on mount; button = "Refresh" in remote mode, "Run scan" locally; fix "local dev only" copy
- [x] stock-scanner/configs/scanner.yaml: add SET50 so `serve` matches `--all`
- [x] DEPLOY.md: document hosting the container + Vercel env vars
- [x] Syntax check

## Notes
Vercel can't run Go/bash or a 4-min scan. stock-scanner already has `serve` mode + Dockerfile (hourly rescan, bearer token), so host that elsewhere (Fly/Render/Railway/Cloud Run) and proxy.
