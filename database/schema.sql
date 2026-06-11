/* ============================================================================
   schema.sql — Full normalized schema for asset-portfolio
   Run this in Supabase SQL Editor (once, on a fresh project).

   Tables
   ──────
   users      — one row per portfolio identity
   settings   — display preferences (1:1 with users)
   holdings   — individual buy lots (many per user)
   sectors    — sector tag per (user, class, ticker)
   snapshots  — daily total-value snapshot in THB
   sales      — realized sell log
   fx_rates   — latest FX rate per pair per user

   Sections
   ────────
   1. Schema
   2. Indexes
   3. Row-Level Security
   4. Migration from old blob table  ← run AFTER tables exist
   ============================================================================ */


-- ── 1. SCHEMA ────────────────────────────────────────────────────────────────

create table if not exists users (
  id          text        primary key check (id ~ '^[a-zA-Z0-9_\-]{6,64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists settings (
  user_id     text        primary key references users(id) on delete cascade,
  display_ccy text        not null default 'THB',
  theme       text        not null default 'light',
  chart_style text        not null default 'donut',
  palette     text        not null default 'class',
  layout      text        not null default 'overview',
  decimals    int         not null default 2,
  updated_at  timestamptz not null default now()
);

create table if not exists holdings (
  id          text          primary key,
  user_id     text          not null references users(id) on delete cascade,
  class_key   text          not null,   -- 'thaiStock' | 'usaStock' | 'etf' | 'fund' | 'crypto' | 'gold' | 'other'
  name        text          not null,   -- ticker / fund name
  type        text,                     -- optional sub-type (used by 'other')
  price       numeric(18,8) not null,   -- buy price per unit (native ccy)
  qty         numeric(18,8) not null,   -- units held
  cur         numeric(18,8),            -- current price per unit (null = use price)
  created_at  timestamptz   not null default now()
);

create table if not exists sectors (
  user_id     text not null references users(id) on delete cascade,
  class_key   text not null,
  name        text not null,            -- ticker / fund name
  sector      text not null,
  primary key (user_id, class_key, name)
);

create table if not exists snapshots (
  user_id  text          not null references users(id) on delete cascade,
  date     date          not null,
  value    numeric(18,2) not null,      -- total portfolio value in THB
  primary key (user_id, date)
);

create table if not exists fx_rates (
  user_id     text          not null references users(id) on delete cascade,
  pair        text          not null default 'USDTHB',
  rate        numeric(12,6) not null,
  recorded_at timestamptz   not null default now(),
  primary key (user_id, pair)
);

create table if not exists sales (
  id           text          primary key,
  user_id      text          not null references users(id) on delete cascade,
  date         date          not null,
  class_key    text          not null,
  name         text          not null,
  ccy          text          not null default 'THB',
  buy_price    numeric(18,8) not null,
  sell_price   numeric(18,8) not null,
  qty          numeric(18,8) not null,
  cost         numeric(18,4) not null,
  proceeds     numeric(18,4) not null,
  realized_pnl numeric(18,4) not null,
  pnl_pct      numeric(10,4) not null,
  created_at   timestamptz   not null default now()
);


-- ── 2. INDEXES ───────────────────────────────────────────────────────────────

create index if not exists holdings_user_id_idx   on holdings  (user_id);
create index if not exists snapshots_user_date_idx on snapshots (user_id, date);
create index if not exists sales_user_date_idx     on sales     (user_id, date);
create index if not exists sectors_user_idx        on sectors   (user_id);


-- ── 3. ROW-LEVEL SECURITY ────────────────────────────────────────────────────
-- Service-role key bypasses RLS entirely, so these policies protect against
-- accidental anon/authenticated key exposure. The API only uses service-role.

alter table users      enable row level security;
alter table settings   enable row level security;
alter table holdings   enable row level security;
alter table sectors    enable row level security;
alter table snapshots  enable row level security;
alter table fx_rates   enable row level security;
alter table sales      enable row level security;

-- No anon/authenticated access — service-role key only
create policy "deny anon" on users      for all using (false);
create policy "deny anon" on settings   for all using (false);
create policy "deny anon" on holdings   for all using (false);
create policy "deny anon" on sectors    for all using (false);
create policy "deny anon" on snapshots  for all using (false);
create policy "deny anon" on fx_rates   for all using (false);
create policy "deny anon" on sales      for all using (false);


-- ── WALLET TABLES ────────────────────────────────────────────────────────────

create table if not exists wallet_accounts (
  id           text          primary key,
  user_id      text          not null references users(id) on delete cascade,
  name         text          not null,
  type         text          not null default 'bank',  -- 'bank' | 'cash' | 'credit_card' | 'ewallet'
  currency     text          not null default 'THB',   -- 'THB' | 'USD' | 'JPY' | 'KRW'
  color        text,
  initial_bal  numeric(18,2) not null default 0,
  credit_limit numeric(18,2),
  sort_order   int           not null default 0,
  archived     boolean       not null default false,
  created_at   timestamptz   not null default now()
);

create table if not exists wallet_categories (
  id       text primary key,
  user_id  text not null references users(id) on delete cascade,
  name     text not null,
  flow     text not null,   -- 'income' | 'expense'
  icon     text,
  color    text
);

create table if not exists wallet_transactions (
  id            text          primary key,
  user_id       text          not null references users(id) on delete cascade,
  account_id    text          not null,
  date          date          not null,
  amount        numeric(18,2) not null,
  flow          text          not null,  -- 'income' | 'expense' | 'transfer'
  category_id   text,
  note          text,
  to_account_id text,
  fx_rate       numeric(12,6),
  created_at    timestamptz   not null default now()
);

create table if not exists wallet_debts (
  id           text          primary key,
  user_id      text          not null references users(id) on delete cascade,
  direction    text          not null,   -- 'lent' | 'borrowed'
  counterparty text          not null,
  amount       numeric(18,2) not null,
  currency     text          not null default 'THB',
  date_start   date          not null,
  date_due     date,
  note         text,
  settled      boolean       not null default false,
  settled_date date,
  installment  jsonb,                    -- { months, interestRate, paidMonths }
  created_at   timestamptz   not null default now()
);

create index if not exists wallet_accounts_user_idx     on wallet_accounts     (user_id);
create index if not exists wallet_categories_user_idx   on wallet_categories   (user_id);
create index if not exists wallet_txn_user_date_idx     on wallet_transactions (user_id, date);
create index if not exists wallet_debts_user_idx        on wallet_debts        (user_id);

alter table wallet_accounts     enable row level security;
alter table wallet_categories   enable row level security;
alter table wallet_transactions enable row level security;
alter table wallet_debts        enable row level security;

create policy "deny anon" on wallet_accounts     for all using (false);
create policy "deny anon" on wallet_categories   for all using (false);
create policy "deny anon" on wallet_transactions for all using (false);
create policy "deny anon" on wallet_debts        for all using (false);


-- ── 4. MIGRATION from old blob table ─────────────────────────────────────────
-- Run this block AFTER the tables above are created and ONLY if you had the
-- old `portfolios` table with a single `data text` column.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING / DO UPDATE).

do $$
declare
  r          record;
  portfolio  jsonb;
  lot        jsonb;
  ck         text;
  sk         text;
  colon_pos  int;
begin
  -- Skip entirely if old table doesn't exist
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'portfolios'
  ) then
    raise notice 'portfolios table not found — skipping migration';
    return;
  end if;

  for r in select id, data from portfolios loop
    -- Wrap each user in its own savepoint so a bad row never aborts the whole block.
    begin

    begin
      portfolio := r.data::jsonb;
    exception when others then
      raise notice 'skipping id % — invalid JSON', r.id;
      continue;
    end;

    -- users
    insert into users (id) values (r.id)
    on conflict (id) do nothing;

    -- settings
    insert into settings (
      user_id, display_ccy, theme, chart_style, palette, layout, decimals
    ) values (
      r.id,
      coalesce(portfolio->'settings'->>'displayCcy', 'THB'),
      coalesce(portfolio->'settings'->>'theme', 'light'),
      coalesce(portfolio->'settings'->>'chartStyle', 'donut'),
      coalesce(portfolio->'settings'->>'palette', 'class'),
      coalesce(portfolio->'settings'->>'layout', 'overview'),
      coalesce((portfolio->'settings'->>'decimals')::int, 2)
    )
    on conflict (user_id) do update set
      display_ccy = excluded.display_ccy,
      theme       = excluded.theme,
      chart_style = excluded.chart_style,
      palette     = excluded.palette,
      layout      = excluded.layout,
      decimals    = excluded.decimals;

    -- holdings
    if portfolio ? 'holdings' then
      for ck in select jsonb_object_keys(portfolio->'holdings') loop
        for lot in
          select jsonb_array_elements(portfolio->'holdings'->ck)
        loop
          insert into holdings (id, user_id, class_key, name, type, price, qty, cur)
          values (
            coalesce(lot->>'id', gen_random_uuid()::text),
            r.id,
            ck,
            lot->>'name',
            nullif(lot->>'type', ''),
            (lot->>'price')::numeric,
            (lot->>'qty')::numeric,
            case when lot->>'cur' is not null then (lot->>'cur')::numeric end
          )
          on conflict (id) do nothing;
        end loop;
      end loop;
    end if;

    -- sectors  (key format: "classKey:name")
    if portfolio ? 'sectors' then
      for sk in select jsonb_object_keys(portfolio->'sectors') loop
        colon_pos := position(':' in sk);
        if colon_pos > 0 then
          insert into sectors (user_id, class_key, name, sector)
          values (
            r.id,
            left(sk, colon_pos - 1),
            substring(sk from colon_pos + 1),
            portfolio->'sectors'->>sk
          )
          on conflict (user_id, class_key, name)
          do update set sector = excluded.sector;
        end if;
      end loop;
    end if;

    -- snapshots
    for lot in
      select jsonb_array_elements(coalesce(portfolio->'snapshots', '[]'::jsonb))
    loop
      insert into snapshots (user_id, date, value)
      values (
        r.id,
        (lot->>'date')::date,
        (lot->>'value')::numeric
      )
      on conflict (user_id, date)
      do update set value = excluded.value;
    end loop;

    -- sales
    for lot in
      select jsonb_array_elements(coalesce(portfolio->'sales', '[]'::jsonb))
    loop
      insert into sales (
        id, user_id, date, class_key, name, ccy,
        buy_price, sell_price, qty, cost, proceeds, realized_pnl, pnl_pct
      ) values (
        coalesce(lot->>'id', gen_random_uuid()::text),
        r.id,
        (lot->>'date')::date,
        lot->>'classKey',
        lot->>'name',
        coalesce(lot->>'ccy', 'THB'),
        (lot->>'buyPrice')::numeric,
        (lot->>'sellPrice')::numeric,
        (lot->>'qty')::numeric,
        (lot->>'cost')::numeric,
        (lot->>'proceeds')::numeric,
        (lot->>'realizedPnl')::numeric,
        (lot->>'pnlPct')::numeric
      )
      on conflict (id) do nothing;
    end loop;

    -- fx_rates
    if (portfolio->'fx'->>'USDTHB') is not null then
      insert into fx_rates (user_id, pair, rate)
      values (r.id, 'USDTHB', (portfolio->'fx'->>'USDTHB')::numeric)
      on conflict (user_id, pair)
      do update set rate = excluded.rate;
    end if;

    raise notice 'migrated user %', r.id;

    exception when others then
      raise notice 'error migrating user % — %', r.id, sqlerrm;
    end; -- per-user savepoint
  end loop;
end $$;


-- ── 5. MIGRATIONS (run against existing databases) ───────────────────────────
-- Add installment column to wallet_debts if it doesn't exist yet.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wallet_debts' and column_name = 'installment'
  ) then
    alter table wallet_debts add column installment jsonb;
  end if;
end $$;


-- ── 6. NEW TABLES & ADDITIVE COLUMNS (schema v2) ─────────────────────────────
-- Safe to run on an existing database — all statements use IF NOT EXISTS.

-- market_prices: current price per (user, class, ticker). Replaces holdings.cur
-- as the canonical live-price store. holdings.cur is kept during migration and
-- can be dropped once this table is populated and the API is deployed.
create table if not exists market_prices (
  user_id      text          not null references users(id) on delete cascade,
  class_key    text          not null,
  name         text          not null,   -- ticker / fund code
  price        numeric(18,8) not null check (price >= 0),
  source       text,                     -- 'yahoo' | 'settrade' | 'coingecko' | 'manual'
  refreshed_at timestamptz   not null default now(),
  primary key (user_id, class_key, name)
);
create index if not exists market_prices_user_idx on market_prices (user_id);

alter table market_prices enable row level security;
create policy "deny anon" on market_prices for all using (false);

-- price_history: append-only price log written on each price refresh.
create table if not exists price_history (
  id          uuid          primary key default gen_random_uuid(),
  user_id     text          not null references users(id) on delete cascade,
  class_key   text          not null,
  name        text          not null,
  price       numeric(18,8) not null check (price >= 0),
  source      text,
  recorded_at timestamptz   not null default now()
);
create index if not exists price_history_user_name_time_idx
  on price_history (user_id, class_key, name, recorded_at desc);

alter table price_history enable row level security;
create policy "deny anon" on price_history for all using (false);

-- debt_payments: individual installment payment records (audit log).
create table if not exists debt_payments (
  id            uuid          primary key default gen_random_uuid(),
  user_id       text          not null references users(id) on delete cascade,
  debt_id       text          not null references wallet_debts(id) on delete cascade,
  wallet_txn_id text          references wallet_transactions(id) on delete set null,
  payment_date  date          not null,
  amount        numeric(18,2) not null check (amount > 0),
  month_number  smallint,     -- which installment month this covers (1-based)
  created_at    timestamptz   not null default now()
);
create index if not exists debt_payments_debt_idx on debt_payments (debt_id);

alter table debt_payments enable row level security;
create policy "deny anon" on debt_payments for all using (false);

-- Additive columns on existing tables (all IF NOT EXISTS, safe to re-run).

do $$ begin
  -- holdings: purchase date (optional, for cost-basis tracking)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'holdings' and column_name = 'bought_at'
  ) then
    alter table holdings add column bought_at date;
  end if;

  -- snapshots: per-class value breakdown in THB (nullable — old rows keep nulls)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'snapshots' and column_name = 'thai_stock'
  ) then
    alter table snapshots
      add column thai_stock numeric(18,2),
      add column usa_stock  numeric(18,2),
      add column etf        numeric(18,2),
      add column fund       numeric(18,2),
      add column crypto     numeric(18,2),
      add column gold       numeric(18,2),
      add column other      numeric(18,2);
  end if;

  -- wallet_debts: linked account FK (was in store.js but never persisted)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wallet_debts' and column_name = 'linked_account_id'
  ) then
    alter table wallet_debts
      add column linked_account_id  text,
      add column inst_months        smallint,
      add column inst_interest_rate numeric(6,4),
      add column inst_paid_months   smallint not null default 0;
  end if;

  -- wallet_transactions: optional FK to the holding lot that triggered this txn
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wallet_transactions' and column_name = 'holding_lot_id'
  ) then
    alter table wallet_transactions
      add column holding_lot_id text;
  end if;

  -- sales: optional FK back to the originating lot
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'sales' and column_name = 'lot_id'
  ) then
    alter table sales
      add column lot_id        text,
      add column wallet_txn_id text;
  end if;

  -- wallet_categories: flag for built-in default categories
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wallet_categories' and column_name = 'is_system'
  ) then
    alter table wallet_categories
      add column is_system  boolean not null default false,
      add column sort_order int     not null default 0;
  end if;
end $$;


-- ── 7. DATA MIGRATION (run once after section 6) ─────────────────────────────
-- Populate market_prices from existing holdings.cur values.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
insert into market_prices (user_id, class_key, name, price, source, refreshed_at)
select distinct on (user_id, class_key, name)
  user_id, class_key, name,
  coalesce(cur, price),
  'migrated',
  now()
from holdings
where cur is not null or price is not null
on conflict (user_id, class_key, name) do nothing;

-- Normalize installment JSONB → typed columns in wallet_debts.
-- Run once. After verifying the API reads from typed columns, drop the jsonb column.
update wallet_debts
set
  inst_months        = (installment->>'months')::smallint,
  inst_interest_rate = (installment->>'interestRate')::numeric,
  inst_paid_months   = coalesce((installment->>'paidMonths')::smallint, 0)
where installment is not null
  and inst_months is null;  -- idempotent: skip rows already migrated


-- ── 9. TAGS (schema v3) ───────────────────────────────────────────────────────
-- asset_tags: user-defined tag definitions (many per user)
create table if not exists asset_tags (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6b7280',
  sort_order int  not null default 0
);
create index if not exists asset_tags_user_idx on asset_tags (user_id);
alter table asset_tags enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'asset_tags' and policyname = 'deny anon'
  ) then
    execute 'create policy "deny anon" on asset_tags for all using (false)';
  end if;
end $$;

-- holding_tags: many tags per ticker, keyed by (class_key, name) like sectors
create table if not exists holding_tags (
  user_id   text not null references users(id) on delete cascade,
  class_key text not null,
  name      text not null,   -- ticker / fund name
  tag_id    text not null,
  primary key (user_id, class_key, name, tag_id)
);
create index if not exists holding_tags_user_idx on holding_tags (user_id);
alter table holding_tags enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'holding_tags' and policyname = 'deny anon'
  ) then
    execute 'create policy "deny anon" on holding_tags for all using (false)';
  end if;
end $$;

-- ── watchlist ─────────────────────────────────────────────────────────────────
-- Stores the set of tickers a portfolio wants to watch.
-- Price data is cached here (nullable) so a refresh isn't needed on every load.
create table if not exists watchlist (
  id               uuid        default gen_random_uuid() primary key,
  portfolio_id     text        not null references users(id) on delete cascade,
  ticker           text        not null check (length(ticker) between 1 and 20),
  type             text        not null default 'stock'
                               check (type in ('stock', 'crypto')),
  name             text,                       -- display name (cached)
  price            numeric,                    -- last fetched price (USD)
  price_updated_at timestamptz,               -- when price was last fetched
  created_at       timestamptz not null default now(),
  constraint watchlist_portfolio_ticker_key unique (portfolio_id, ticker)
);

create index if not exists watchlist_portfolio_id_idx on watchlist (portfolio_id);

alter table watchlist enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'watchlist' and policyname = 'deny anon'
  ) then
    execute 'create policy "deny anon" on watchlist for all using (false)';
  end if;
end $$;


-- ── 10. PERSISTENCE GAPS (schema v4) ──────────────────────────────────────────
-- Fields store.js sent on every save but the API previously dropped (so they
-- only survived in the current browser session). See database/migrate_persist_gaps.sql
-- for the full rationale. All statements are idempotent.

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

create table if not exists target_allocation (
  user_id    text         not null references users(id) on delete cascade,
  class_key  text         not null,
  target_pct numeric(7,3) not null,
  primary key (user_id, class_key)
);

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

create table if not exists holding_notes (
  user_id   text not null references users(id) on delete cascade,
  class_key text not null,
  name      text not null,
  note      text not null,
  primary key (user_id, class_key, name)
);

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

create table if not exists wallet_snapshots (
  user_id     text          not null references users(id) on delete cascade,
  date        date          not null,
  net_worth   numeric(18,2) not null,
  cash        numeric(18,2),
  liabilities numeric(18,2),
  primary key (user_id, date)
);

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
