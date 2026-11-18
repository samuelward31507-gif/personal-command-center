-- Fence job paperwork: the 811 locate ticket (number, requested, clears on), the permit, HOA approval, the property
-- line or survey pins and the customer's sign-off on the line, with dates. Settling one also ticks the matching job
-- step (locate, permit, hoa) so nothing is tracked twice. Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS paperwork jsonb;
