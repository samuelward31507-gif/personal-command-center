-- Kickoff checklist uploads: the client's IRS EIN letter (CP 575 or 147C), open-quote and past-customer lists.
-- Additive only: one new table. Files are read back only through the signed-in CRM.
BEGIN;
CREATE TABLE IF NOT EXISTS public.kickoff_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  kickoff_id uuid NOT NULL REFERENCES public.kickoff_requests(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field ~ '^[a-z_]{1,40}$'),
  filename text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL CHECK (size > 0 AND size <= 4500000),
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kickoff_files_kickoff_idx ON public.kickoff_files (kickoff_id, field, created_at DESC);
COMMIT;
