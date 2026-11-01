-- Invoices on existing revenue entries: a number, a private link for the client, and when it was sent / last chased.
-- Additive only: new nullable columns and indexes on revenue_entries. No existing values change.
BEGIN;
ALTER TABLE public.revenue_entries
  ADD COLUMN IF NOT EXISTS invoice_number integer,
  ADD COLUMN IF NOT EXISTS invoice_token text,
  ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS revenue_entries_invoice_number_idx ON public.revenue_entries (owner_id, invoice_number) WHERE invoice_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS revenue_entries_invoice_token_idx ON public.revenue_entries (invoice_token) WHERE invoice_token IS NOT NULL;
COMMIT;
