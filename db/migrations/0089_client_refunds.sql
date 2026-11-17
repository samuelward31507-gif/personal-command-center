-- Money given back on a paid invoice (part of a job canceled, a goodwill credit). A refund lowers what the invoice
-- charged by the same amount, so the balance stays settled and no reminders go out; collected money goes down.
-- Kept apart from client_payments so balances and the QuickBooks payment sync are untouched. Additive only.
CREATE TABLE IF NOT EXISTS public.client_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'other',
  refunded_on date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_refunds_project_idx ON public.client_refunds (project_id, refunded_on DESC);
CREATE INDEX IF NOT EXISTS client_refunds_invoice_idx ON public.client_refunds (invoice_id);
