# Plan: Local dev without Vercel

**Goal:** `make local` runs the app at localhost:3000 with a local Postgres (Docker) and no Vercel CLI.

## Steps
- [x] docker-compose.yml: Postgres + PostgREST (Supabase REST emulation)
- [x] database/local_seed.sql: demo user (demo/demo)
- [x] dev-server.mjs: static files + adapts api/*.js handlers, points SUPABASE_URL at PostgREST
- [x] Makefile targets: local, db-up, db-down, db-reset
- [x] Run and verify login + /api/portfolio

## Notes
api/*.js talk to Supabase via REST only, so PostgREST is a drop-in.
