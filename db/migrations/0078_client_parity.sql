-- Parity with the tools owners switch from: a reusable checklist filled in on the job, and the day-before reminder for
-- installs (estimates and plan visits already have theirs). Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS checklist jsonb;                 -- { name, items: [{ label, done, at, by }] }
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS install_reminded_on date;
