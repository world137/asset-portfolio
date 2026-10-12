/* Per-class day change (THB) captured with each daily snapshot.
   Shape: {"thaiStock": 1234.5, "usaStock": -300, ...}
   Run once in the Supabase SQL editor BEFORE deploying the updated API. */
alter table public.snapshots add column if not exists day_change jsonb;
