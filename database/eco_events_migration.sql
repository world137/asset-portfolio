-- Migration: add eco_events table
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.eco_events (
  id          text NOT NULL,
  user_id     text NOT NULL,
  date        date NOT NULL,
  type        text NOT NULL DEFAULT 'other',
  label       text NOT NULL,
  importance  text NOT NULL DEFAULT 'medium',
  note        text,
  CONSTRAINT eco_events_pkey        PRIMARY KEY (id),
  CONSTRAINT eco_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS eco_events_user_id_date_idx ON public.eco_events (user_id, date);
