-- Prospect reports: a private one-page link per prospect showing what slow follow-up likely costs them.
-- Additive only: a new table. Nothing existing changes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.prospect_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  company text NOT NULL,
  trade text NOT NULL DEFAULT 'other',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT '',
  view_count integer NOT NULL DEFAULT 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_reports_owner_contact_idx ON public.prospect_reports (owner_id, contact_id, created_at DESC);
COMMIT;
