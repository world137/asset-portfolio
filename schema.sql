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
