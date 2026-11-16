-- The customer's own page (one private link per customer), the job sign-off at the end of a job, and QuickBooks Online
-- (customers, invoices and payments pushed to the owner's books). Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS portal_token text;
CREATE UNIQUE INDEX IF NOT EXISTS client_threads_portal_token_idx ON public.client_threads (portal_token) WHERE portal_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.client_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  signed_by text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',          -- a small PNG data URL drawn on the phone
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ label, done }]
  note text NOT NULL DEFAULT '',
  member text NOT NULL DEFAULT '',             -- who held the phone: '' the owner, else their +1 cell
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_signoffs_thread_idx ON public.client_signoffs (thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_qbo (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  realm_id text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  refresh_token_enc text NOT NULL,
  access_token_enc text NOT NULL DEFAULT '',
  access_expires_at timestamptz,
  item_id text NOT NULL DEFAULT '',            -- the "Services" item invoice lines are booked to
  last_error text NOT NULL DEFAULT '',
  last_push_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS qbo_customer_id text NOT NULL DEFAULT '';
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS qbo_id text NOT NULL DEFAULT '';
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS qbo_id text NOT NULL DEFAULT '';
