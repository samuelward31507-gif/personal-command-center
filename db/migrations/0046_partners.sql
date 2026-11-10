-- Strategic partners: businesses that already talk to fence owners and detailers and can send them our way.
-- Additive only: a new table.
BEGIN;
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  name text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'to_contact',
  referrals integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  last_touch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partners_owner_idx ON public.partners (owner_id, status, updated_at DESC);
COMMIT;
