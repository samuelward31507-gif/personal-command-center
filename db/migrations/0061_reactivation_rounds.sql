-- Reactivation add-on runs continuously: old leads who never answered get another round each quarter (up to 4).
-- Additive only: one defaulted column on client_quotes.
BEGIN;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS rounds integer NOT NULL DEFAULT 1;
COMMIT;
