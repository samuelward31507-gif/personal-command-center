-- Website demo rate limiting: hashed IP and time only. No message content is stored.
CREATE TABLE IF NOT EXISTS public.demo_runs (id bigserial PRIMARY KEY, ip_hash text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS demo_runs_at_idx ON public.demo_runs (at);
