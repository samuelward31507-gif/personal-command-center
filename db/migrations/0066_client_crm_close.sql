-- Closing the loop on the client CRM: quotes customers approve from a link, the review ask after the install,
-- and win-back texts to past customers. Additive only: every column is nullable or has a default.
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS link_sent_at timestamptz;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS client_quotes_token_idx ON public.client_quotes (token) WHERE token IS NOT NULL;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS install_on date;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS review_auto boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS winback_at timestamptz;
CREATE INDEX IF NOT EXISTS client_threads_review_due_idx ON public.client_threads (install_on) WHERE review_auto;
