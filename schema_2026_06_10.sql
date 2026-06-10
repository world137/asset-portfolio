-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id text NOT NULL CHECK (id ~ '^[a-zA-Z0-9_\-]{6,64}$'::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  username text,
  password_hash text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.settings (
  user_id text NOT NULL,
  display_ccy text NOT NULL DEFAULT 'THB'::text,
  theme text NOT NULL DEFAULT 'light'::text,
  chart_style text NOT NULL DEFAULT 'donut'::text,
  palette text NOT NULL DEFAULT 'class'::text,
  layout text NOT NULL DEFAULT 'overview'::text,
  decimals integer NOT NULL DEFAULT 2,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.holdings (
  id text NOT NULL,
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  type text,
  price numeric NOT NULL,
  qty numeric NOT NULL,
  cur numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bought_at date,
  CONSTRAINT holdings_pkey PRIMARY KEY (id),
  CONSTRAINT holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sectors (
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  sector text NOT NULL,
  CONSTRAINT sectors_pkey PRIMARY KEY (user_id, class_key, name),
  CONSTRAINT sectors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.snapshots (
  user_id text NOT NULL,
  date date NOT NULL,
  value numeric NOT NULL,
  thai_stock numeric,
  usa_stock numeric,
  etf numeric,
  fund numeric,
  crypto numeric,
  gold numeric,
  other numeric,
  CONSTRAINT snapshots_pkey PRIMARY KEY (user_id, date),
  CONSTRAINT snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.fx_rates (
  user_id text NOT NULL,
  pair text NOT NULL DEFAULT 'USDTHB'::text,
  rate numeric NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fx_rates_pkey PRIMARY KEY (user_id, pair),
  CONSTRAINT fx_rates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sales (
  id text NOT NULL,
  user_id text NOT NULL,
  date date NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  ccy text NOT NULL DEFAULT 'THB'::text,
  buy_price numeric NOT NULL,
  sell_price numeric NOT NULL,
  qty numeric NOT NULL,
  cost numeric NOT NULL,
  proceeds numeric NOT NULL,
  realized_pnl numeric NOT NULL,
  pnl_pct numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  lot_id text,
  wallet_txn_id text,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_accounts (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bank'::text,
  currency text NOT NULL DEFAULT 'THB'::text,
  color text,
  initial_bal numeric NOT NULL DEFAULT 0,
  credit_limit numeric,
  sort_order integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wallet_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_categories (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  flow text NOT NULL,
  icon text,
  color text,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT wallet_categories_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_transactions (
  id text NOT NULL,
  user_id text NOT NULL,
  account_id text NOT NULL,
  date date NOT NULL,
  amount numeric NOT NULL,
  flow text NOT NULL,
  category_id text,
  note text,
  to_account_id text,
  fx_rate numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  holding_lot_id text,
  CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_debts (
  id text NOT NULL,
  user_id text NOT NULL,
  direction text NOT NULL,
  counterparty text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'THB'::text,
  date_start date NOT NULL,
  date_due date,
  note text,
  settled boolean NOT NULL DEFAULT false,
  settled_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  installment jsonb,
  linked_account_id text,
  inst_months smallint,
  inst_interest_rate numeric,
  inst_paid_months smallint NOT NULL DEFAULT 0,
  CONSTRAINT wallet_debts_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_debts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.market_prices (
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  source text,
  refreshed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT market_prices_pkey PRIMARY KEY (user_id, class_key, name),
  CONSTRAINT market_prices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  source text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT price_history_pkey PRIMARY KEY (id),
  CONSTRAINT price_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  debt_id text NOT NULL,
  wallet_txn_id text,
  payment_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  month_number smallint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT debt_payments_pkey PRIMARY KEY (id),
  CONSTRAINT debt_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT debt_payments_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES public.wallet_debts(id),
  CONSTRAINT debt_payments_wallet_txn_id_fkey FOREIGN KEY (wallet_txn_id) REFERENCES public.wallet_transactions(id)
);
CREATE TABLE public.asset_tags (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280'::text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT asset_tags_pkey PRIMARY KEY (id),
  CONSTRAINT asset_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.holding_tags (
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  tag_id text NOT NULL,
  CONSTRAINT holding_tags_pkey PRIMARY KEY (user_id, class_key, name, tag_id),
  CONSTRAINT holding_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.watchlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id text NOT NULL,
  ticker text NOT NULL CHECK (length(ticker) >= 1 AND length(ticker) <= 20),
  type text NOT NULL DEFAULT 'stock'::text CHECK (type = ANY (ARRAY['stock'::text, 'crypto'::text])),
  name text,
  price numeric,
  price_updated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_pkey PRIMARY KEY (id),
  CONSTRAINT watchlist_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.users(id)
);
CREATE TABLE public.goals (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  target_date date,
  note text,
  emoji text,
  created_at date,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT goals_pkey PRIMARY KEY (id),
  CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.dividends (
  id text NOT NULL,
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  ex_date date,
  pay_date date,
  amount_per_share numeric,
  total_amount numeric,
  currency text NOT NULL DEFAULT 'THB'::text,
  note text,
  CONSTRAINT dividends_pkey PRIMARY KEY (id),
  CONSTRAINT dividends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.target_allocation (
  user_id text NOT NULL,
  class_key text NOT NULL,
  target_pct numeric NOT NULL,
  CONSTRAINT target_allocation_pkey PRIMARY KEY (user_id, class_key),
  CONSTRAINT target_allocation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.price_alerts (
  id text NOT NULL,
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  condition text NOT NULL CHECK (condition = ANY (ARRAY['above'::text, 'below'::text])),
  price numeric NOT NULL,
  note text,
  triggered boolean NOT NULL DEFAULT false,
  CONSTRAINT price_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT price_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.holding_notes (
  user_id text NOT NULL,
  class_key text NOT NULL,
  name text NOT NULL,
  note text NOT NULL,
  CONSTRAINT holding_notes_pkey PRIMARY KEY (user_id, class_key, name),
  CONSTRAINT holding_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_bills (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'THB'::text,
  due_day smallint,
  category_id text,
  note text,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT wallet_bills_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_bills_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_savings_goals (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'THB'::text,
  target_date date,
  linked_account_id text,
  note text,
  emoji text,
  CONSTRAINT wallet_savings_goals_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_savings_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.wallet_snapshots (
  user_id text NOT NULL,
  date date NOT NULL,
  net_worth numeric NOT NULL,
  cash numeric,
  liabilities numeric,
  CONSTRAINT wallet_snapshots_pkey PRIMARY KEY (user_id, date),
  CONSTRAINT wallet_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);