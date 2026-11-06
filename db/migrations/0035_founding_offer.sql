-- Founding offer (The 30-Day Estimate Sprint): discovery fields on contacts, offer flag on clients,
-- delivery tracker + Review Builder setup on client_ops, and a log of booked estimates per client.
-- Additive only: three new columns with defaults, one new column with a default, one new table. Nothing existing changes.
BEGIN;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS discovery jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS offer text NOT NULL DEFAULT 'standard';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_offer_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_offer_check CHECK (offer IN ('standard','founding'));
  END IF;
END $$;
ALTER TABLE public.client_ops ADD COLUMN IF NOT EXISTS delivery jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.client_ops ADD COLUMN IF NOT EXISTS reviews jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.client_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  booked_on date NOT NULL,
  estimate_at timestamptz,
  homeowner text NOT NULL DEFAULT '',
  source text NOT NULL CHECK (source IN ('revival','callback','other')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_bookings_owner_project_idx ON public.client_bookings (owner_id, project_id, booked_on);
CREATE INDEX IF NOT EXISTS projects_owner_offer_idx ON public.projects (owner_id, offer) WHERE offer = 'founding';
COMMIT;
