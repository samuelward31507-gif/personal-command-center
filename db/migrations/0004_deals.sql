CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  service_type text NOT NULL DEFAULT 'custom_ai_implementation',
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','qualified','discovery','proposal','negotiation','won','lost')),
  setup_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (setup_fee >= 0),
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  expected_close_date date,
  source text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  lost_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deals_owner_stage_updated_idx ON public.deals (owner_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS deals_owner_close_date_idx ON public.deals (owner_id, expected_close_date);
CREATE INDEX IF NOT EXISTS deals_owner_contact_idx ON public.deals (owner_id, contact_id);
