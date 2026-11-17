-- Late fees: when the owner turns them on, an invoice past due by their number of days gets one late-fee line, once.
-- This marks when it was added so it never happens twice. Additive only.
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS late_fee_at timestamptz;
