-- Service plans (recurring visits the app schedules, reminds and invoices), change orders the customer approves by link,
-- crew hours clocked from the truck, and the review ask that follows a paid invoice. Additive only.
CREATE TABLE IF NOT EXISTS public.client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  every_n integer NOT NULL DEFAULT 1 CHECK (every_n BETWEEN 1 AND 52),
  every_unit text NOT NULL DEFAULT 'month' CHECK (every_unit IN ('week', 'month')),
  next_on date,
  visit_time text,
  ends_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  remind boolean NOT NULL DEFAULT true,
  auto_invoice boolean NOT NULL DEFAULT true,
  crew_member text NOT NULL DEFAULT '',
  reminded_for date,
  visits_done integer NOT NULL DEFAULT 0,
  last_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_plans_project_idx ON public.client_plans (project_id, status);
CREATE INDEX IF NOT EXISTS client_plans_next_idx ON public.client_plans (next_on) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.client_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  on_date date NOT NULL,
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'skipped')),
  invoice_id uuid,
  member text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_visits_plan_idx ON public.client_visits (plan_id, on_date DESC);

CREATE TABLE IF NOT EXISTS public.client_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  number integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'void')),
  token text UNIQUE,
  signed_by text NOT NULL DEFAULT '',
  sent_at timestamptz,
  viewed_at timestamptz,
  decided_at timestamptz,
  invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_change_orders_thread_idx ON public.client_change_orders (thread_id, number);

CREATE TABLE IF NOT EXISTS public.client_time (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid,
  member text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_time_project_idx ON public.client_time (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS client_time_open_idx ON public.client_time (project_id, member) WHERE ended_at IS NULL;

ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS review_after timestamptz;
-- An invoice for a plan's visit names its plan, so it never stands in for the job's own invoice.
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS plan_id uuid;
