-- Customer tags (for finding and texting a group: "commercial", "HOA", "2025 storm") and who referred a customer. Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS referred_by uuid;
CREATE INDEX IF NOT EXISTS client_threads_tags_idx ON public.client_threads USING gin (tags);
