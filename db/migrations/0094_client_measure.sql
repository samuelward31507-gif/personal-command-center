-- Measure-to-quote: the fence line drawn on the satellite map for a job (runs, gates, tear-out), saved on the job so it
-- can be edited later, priced, shown on the quote and to the crew. The owner's fence types live in setup. Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS measure jsonb;
