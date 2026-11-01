-- Operations: per-client setup sheet, message approval and launch test; expenses; compliance; prospect touches.
-- Additive only: four new tables. Nothing existing changes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_ops (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  setup jsonb NOT NULL DEFAULT '{}'::jsonb,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  launch jsonb NOT NULL DEFAULT '{}'::jsonb,
  portal_token text UNIQUE,
  approval_token text UNIQUE,
  approval_sent_at timestamptz,
  approved_at timestamptz,
  approved_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_ops_owner_idx ON public.client_ops (owner_id);
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  spent_on date NOT NULL,
  vendor text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  recurring boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_owner_date_idx ON public.expenses (owner_id, spent_on DESC);
CREATE TABLE IF NOT EXISTS public.compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  due_date date,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  repeat_months integer CHECK (repeat_months IS NULL OR repeat_months BETWEEN 1 AND 60),
  note text NOT NULL DEFAULT '',
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_owner_due_idx ON public.compliance_items (owner_id, status, due_date);
CREATE TABLE IF NOT EXISTS public.prospect_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('dm_sent','follow_up_sent','replied','not_interested')),
  channel text NOT NULL DEFAULT 'instagram',
  note text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_touches_owner_idx ON public.prospect_touches (owner_id, contact_id, at DESC);
ALTER TABLE public.client_ops ADD COLUMN IF NOT EXISTS approved_by text NOT NULL DEFAULT '';
COMMIT;
