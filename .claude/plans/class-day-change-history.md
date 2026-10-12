# Plan: Per-tab day-change history chart

**Goal:** Each asset tab shows a chart of daily day-change snapshots, persisted in Supabase.

## Steps
- [x] SQL migration: add snapshots.day_change jsonb
- [x] takeSnapshot stores per-class day change (THB)
- [x] api/portfolio.js + api/data-transfer.js read/write day_change
- [x] DayChangeHistory chart in HoldingsView tab

## Notes
Existing snapshots only hold class values (affected by buys/sells) so day change can't be derived reliably -> new column needed.
