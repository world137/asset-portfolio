-- Migration: latest published stock-scanner result (single row, id = 'latest').
-- Run in the Supabase SQL Editor before using stock-scanner/scripts/publish-scan.sh.

CREATE TABLE IF NOT EXISTS public.scanner_results (
  id         text PRIMARY KEY,
  result     jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only the service-role key (server) may touch it, like the other tables.
ALTER TABLE public.scanner_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scanner_results' AND policyname = 'deny anon') THEN
    CREATE POLICY "deny anon" ON public.scanner_results FOR ALL USING (false);
  END IF;
END $$;
