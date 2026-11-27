-- 0098: one row per message sent to the website chat assistant, only to rate-limit it.
-- Additive. Holds a one-way hash of the visitor's IP and a time. No message text is stored.
CREATE TABLE IF NOT EXISTS public.site_chat_turns (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_chat_turns_at_idx ON public.site_chat_turns (at);
