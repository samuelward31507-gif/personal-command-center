-- Quote chasing: how many times the customer opened the quote, and when they last did. Additive only.
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;
