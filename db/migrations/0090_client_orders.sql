-- Material orders on a job: what to buy, from which supplier, by when; draft, ordered, received or canceled. When an
-- order is received its total lands in the job's expenses (materials), so job costing counts it. Additive only.
CREATE TABLE IF NOT EXISTS public.client_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  supplier text NOT NULL DEFAULT '',
  supplier_email text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,              -- [{ name, qty, unit, cost }]
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'canceled')),
  needed_on date,
  note text NOT NULL DEFAULT '',
  ordered_at timestamptz,
  received_at timestamptz,
  expense_id uuid,                                         -- the materials expense made when it was received
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_orders_project_idx ON public.client_orders (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_orders_thread_idx ON public.client_orders (thread_id);
