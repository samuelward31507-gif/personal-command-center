-- The customer's name and drawn signature when they approve a quote online, kept with the quote.
-- Additive only: two nullable columns, no row changes.
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS signed_name text;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS signature text;
