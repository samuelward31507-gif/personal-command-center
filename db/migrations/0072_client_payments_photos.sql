-- Partial payments on invoices (the money still moves through the owner's own pay link, cash or check; Cinder only
-- records what came in), and job photos kept with the customer's record. Additive only.
CREATE TABLE IF NOT EXISTS public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'other' CHECK (method IN ('card', 'cash', 'check', 'bank', 'other')),
  paid_on date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_payments_invoice_idx ON public.client_payments (invoice_id);
CREATE INDEX IF NOT EXISTS client_payments_project_idx ON public.client_payments (project_id, paid_on DESC);
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.client_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('before', 'during', 'after', 'other')),
  caption text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'image/jpeg',
  bytes bytea NOT NULL,
  size integer NOT NULL DEFAULT 0,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_photos_thread_idx ON public.client_photos (thread_id, created_at);
