-- Jobber's core without the bloat: quotes with line items, installs on the owner's Google Calendar, invoices paid
-- through the owner's own pay link (Cinder never holds money), and payment reminders. Additive only.
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS install_time text;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS install_days integer NOT NULL DEFAULT 1;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS install_event_id text;

CREATE TABLE IF NOT EXISTS public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  number integer NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  token text UNIQUE,
  due_on date,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  paid_claimed_at timestamptz,
  reminders integer NOT NULL DEFAULT 0,
  reminders_paused boolean NOT NULL DEFAULT false,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);
CREATE INDEX IF NOT EXISTS client_invoices_thread_idx ON public.client_invoices (thread_id);
CREATE INDEX IF NOT EXISTS client_invoices_open_idx ON public.client_invoices (status, due_on) WHERE status = 'sent';
