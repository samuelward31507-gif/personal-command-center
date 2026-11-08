-- Weekly lead runs: LinkedIn profile + trade on each contact, and a log of which metros each run covered so cities rotate.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_url text NOT NULL DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.lead_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  run_date date NOT NULL DEFAULT current_date,
  metros text[] NOT NULL DEFAULT '{}',
  added integer NOT NULL DEFAULT 0,
  with_email integer NOT NULL DEFAULT 0,
  with_linkedin integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_runs_owner_date ON public.lead_runs (owner_id, run_date DESC);
