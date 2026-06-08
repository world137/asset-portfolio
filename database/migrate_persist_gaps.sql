/* ============================================================================
   migrate_persist_gaps.sql — schema v4
   Run once in the Supabase SQL Editor (idempotent — safe to re-run).

   WHY
   ───
   store.js sends these fields to /api/portfolio and /api/wallet on every save,
   but the API silently dropped them — they were never written and never read
   back. As a result they only survived in the current browser tab and were
   LOST on reload from another device or after a cache clear:

     portfolio:  goals · dividends (manual) · targetAllocation
                 priceAlerts · holdingNotes
     wallet:     bills · savingsGoals · walletSnapshots

   This migration adds dedicated tables for each. There is no historical data to
   backfill — the server never stored these — so the tables start empty and are
   populated by the next client save once the updated API is deployed.

   NOTE: auto-fetched dividends (api/dividends.js) are intentionally NOT stored;
   they are derived from holdings and re-fetched per session. Only user-entered
   ("manual") dividends are persisted here.
   ============================================================================ */


-- ── PORTFOLIO GAPS ────────────────────────────────────────────────────────────

-- Financial goals (GoalsView)
create table if not exists goals (
  id            text          primary key,
  user_id       text          not null references users(id) on delete cascade,
  name          text          not null,
  target_amount numeric(18,2) not null default 0,
  target_date   date,
  note          text,
  emoji         text,
  created_at    date,
  sort_order    int           not null default 0
);
create index if not exists goals_user_idx on goals (user_id);

-- Manual dividend / income entries (DividendCalendar)
create table if not exists dividends (
  id               text          primary key,
  user_id          text          not null references users(id) on delete cascade,
  class_key        text          not null,
  name             text          not null,
  ex_date          date,
  pay_date         date,
  amount_per_share numeric(18,8),
  total_amount     numeric(18,4),
  currency         text          not null default 'THB',
  note             text
);
create index if not exists dividends_user_idx on dividends (user_id);

-- Target asset-class allocation %, used by RebalancingView ({ classKey: pct })
create table if not exists target_allocation (
  user_id    text         not null references users(id) on delete cascade,
  class_key  text         not null,
  target_pct numeric(7,3) not null,
  primary key (user_id, class_key)
);

-- Price alerts (AlertsView)
create table if not exists price_alerts (
  id         text          primary key,
  user_id    text          not null references users(id) on delete cascade,
  class_key  text          not null,
  name       text          not null,
  condition  text          not null check (condition in ('above', 'below')),
  price      numeric(18,8) not null,
  note       text,
  triggered  boolean       not null default false
);
create index if not exists price_alerts_user_idx on price_alerts (user_id);

-- Per-holding freeform notes ({ "classKey:name": "note" })
create table if not exists holding_notes (
  user_id   text not null references users(id) on delete cascade,
  class_key text not null,
  name      text not null,
  note      text not null,
  primary key (user_id, class_key, name)
);


-- ── WALLET GAPS ───────────────────────────────────────────────────────────────

-- Monthly bill reminders (BillsView)
create table if not exists wallet_bills (
  id          text          primary key,
  user_id     text          not null references users(id) on delete cascade,
  name        text          not null,
  amount      numeric(18,2) not null default 0,
  currency    text          not null default 'THB',
  due_day     smallint,
  category_id text,
  note        text,
  active      boolean       not null default true
);
create index if not exists wallet_bills_user_idx on wallet_bills (user_id);

-- Savings goals (SavingsGoalsView)
create table if not exists wallet_savings_goals (
  id                text          primary key,
  user_id           text          not null references users(id) on delete cascade,
  name              text          not null,
  target_amount     numeric(18,2) not null default 0,
  currency          text          not null default 'THB',
  target_date       date,
  linked_account_id text,
  note              text,
  emoji             text
);
create index if not exists wallet_savings_goals_user_idx on wallet_savings_goals (user_id);

-- Daily net-worth snapshots (cash + portfolio − liabilities)
create table if not exists wallet_snapshots (
  user_id     text          not null references users(id) on delete cascade,
  date        date          not null,
  net_worth   numeric(18,2) not null,
  cash        numeric(18,2),
  liabilities numeric(18,2),
  primary key (user_id, date)
);


-- ── ROW-LEVEL SECURITY ───────────────────────────────────────────────────────
-- Service-role key bypasses RLS; these policies guard against anon key exposure.
do $$
declare t text;
begin
  foreach t in array array[
    'goals', 'dividends', 'target_allocation', 'price_alerts', 'holding_notes',
    'wallet_bills', 'wallet_savings_goals', 'wallet_snapshots'
  ] loop
    execute format('alter table %I enable row level security', t);
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'deny anon'
    ) then
      execute format('create policy "deny anon" on %I for all using (false)', t);
    end if;
  end loop;
end $$;
