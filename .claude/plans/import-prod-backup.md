# Plan: Make prod backup (2026-10-12) import work

**Goal:** Importing portfolio-backup-2026-10-12 via /api/data-transfer succeeds against a prod DB whose schema lags the code, and restores all backup sections.

## Steps
- [x] Inspect backup shape vs importer (api/data-transfer.js)
- [x] Root cause of `day_change` PGRST204: prod missing migration snapshots_day_change_migration.sql; importer sends null column anyway
- [x] Read api/wallet.js to see how bills/savingsGoals/walletSnapshots are persisted
- [x] Importer: only send `day_change` when a snapshot has it (works on old schema)
- [x] Importer: also import tags, holdingTags, goals, dividends, targetAllocation, priceAlerts, holdingNotes, ecoEvents
- [x] Importer: also import wallet bills, savingsGoals, walletSnapshots
- [x] Dry-run importer against the backup with mocked fetch (override + topup: 200, no day_change sent)
- [x] Report which prod migrations the user must run

## Notes
- Cannot run SQL on prod from here (Supabase MCP not authorized).
- Backup tables with data that must exist in prod: asset_tags, holding_tags, target_allocation, wallet_savings_goals, wallet_snapshots (see database/migrate_persist_gaps.sql, schema_2026_06_10.sql).
