-- Repeat Revenue: a client's past customers with their last service date, so Cinder can text each one when they're
-- due again and offer open times. Additive only: one new table.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  customer_phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  service text NOT NULL DEFAULT '',
  last_service date,
  interval_days integer NOT NULL DEFAULT 90 CHECK (interval_days BETWEEN 7 AND 730),
  next_due date NOT NULL,
  due_steps integer NOT NULL DEFAULT 0,
  due_texted_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'opted_out')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, customer_phone)
);
CREATE INDEX IF NOT EXISTS client_customers_due ON public.client_customers (next_due) WHERE status = 'active';
COMMIT;
