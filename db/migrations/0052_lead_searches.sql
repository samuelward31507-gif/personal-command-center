-- Lead finder: saved searches (a trade in a city) that fill the call list from Google Maps, page by page.
-- Additive only: one new table.
BEGIN;
CREATE TABLE IF NOT EXISTS public.lead_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  trade text NOT NULL,
  city text NOT NULL,
  page_token text NOT NULL DEFAULT '',
  pages integer NOT NULL DEFAULT 0,
  found integer NOT NULL DEFAULT 0,
  added integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','done','paused')),
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, trade, city)
);
COMMIT;
