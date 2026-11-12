-- Lead follow-up: when a new lead goes quiet, up to three friendly nudges (about 2 hours, next day, day 3).
-- Additive only: three nullable/defaulted columns on client_threads.
BEGIN;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS contact_at timestamptz;          -- when the current lead came in (missed call, form, ad)
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS nudges_sent integer NOT NULL DEFAULT 0;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS nudge_anchor timestamptz;        -- the lead activity the nudges are counting from
COMMIT;
