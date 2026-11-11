-- Cinder app: push notification subscriptions per owner device, and photos customers text in. Additive only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_push_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_push_subs_project_idx ON public.app_push_subs (project_id);
ALTER TABLE public.client_texts ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
