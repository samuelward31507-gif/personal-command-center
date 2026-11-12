-- Handoffs that the owner hasn't answered: a reminder to the owner, then a holding text to the customer.
-- Additive only: three nullable columns on client_threads.
BEGIN;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS handoff_at timestamptz;          -- when the reply engine handed this customer to the owner
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS handoff_nudged_at timestamptz;   -- when the owner got the "still waiting" reminder
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS handoff_held_at timestamptz;     -- when the customer got the "sorry for the wait" text
COMMIT;
