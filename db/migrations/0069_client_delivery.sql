-- Delivery status on texts (Twilio's status callback), a deposit on quotes, and notes for the crew on a job.
-- Additive only.
ALTER TABLE public.client_texts ADD COLUMN IF NOT EXISTS sid text;
ALTER TABLE public.client_texts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT '';   -- '' | queued | sent | delivered | undelivered | failed
CREATE INDEX IF NOT EXISTS client_texts_sid_idx ON public.client_texts (sid) WHERE sid IS NOT NULL;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS deposit numeric;                  -- paid through the owner's own pay link, never here
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS crew_notes text NOT NULL DEFAULT '';
