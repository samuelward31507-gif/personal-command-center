-- Owner texting their own Cinder number: "QUOTE 4200" starts quote follow-up on the customer they were last alerted
-- about. Additive only: one nullable column on client_threads.
BEGIN;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS owner_alerted_at timestamptz;
COMMIT;
