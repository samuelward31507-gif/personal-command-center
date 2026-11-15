-- A customer's email on their record, and the owner's "remind me" on a job. Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS remind_at timestamptz;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS remind_note text NOT NULL DEFAULT '';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS remind_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS client_threads_remind_idx ON public.client_threads (remind_at) WHERE remind_at IS NOT NULL AND remind_sent_at IS NULL;
