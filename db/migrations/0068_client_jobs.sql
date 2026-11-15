-- The job after the yes: the steps between Won and Paid (deposit, HOA, permit, 811, materials, install, walk-through),
-- each with the day it was done, and what the job cost so the owner sees profit per job. Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS job_steps jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS job_costs jsonb NOT NULL DEFAULT '{}'::jsonb;
