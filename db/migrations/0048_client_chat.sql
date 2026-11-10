-- Website chat for clients: a public key per client for the chat bubble on their site. Additive only.
ALTER TABLE public.client_ops ADD COLUMN IF NOT EXISTS chat_key text UNIQUE;
-- Revive campaigns reuse the quote follow-up table: kind 'rehash' = an old lead being re-engaged.
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'quote';
