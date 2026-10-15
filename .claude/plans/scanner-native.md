# Plan: Native JS stock scanner (no sh, no env)

**Goal:** Stock Scanner page runs the scan itself on Vercel (and `vercel dev`) with no stock-scanner folder, no publish script, no new env vars.

## Steps
- [x] Read Go scanner (indicators, filters, scorer, universe, yahoo) to port faithfully
- [x] api/_scanner/ : indicators, filters/scorer, universe lists, yahoo fetch (pure JS)
- [x] api/scanner.js: POST {batch} scans a slice of symbols (fits maxDuration); POST {save} / GET latest from Supabase scanner_results (existing table)
- [x] ScannerView.jsx: client drives batches with progress, merges+ranks, saves, shows latest on load
- [x] Remove sh/PUSH_TOKEN/local-dir code paths; update DEPLOY.md
- [x] Syntax check + run a sample scan against Yahoo locally

## Notes
Full scan (~600 symbols) is too long for one function, so the browser drives batches.
