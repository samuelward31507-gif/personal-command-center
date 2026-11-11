-- Client ↔ Sam messages: the client writes from their portal, Sam replies from the CRM. Additive only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('client','owner')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS client_messages_project_idx ON public.client_messages (project_id, created_at);
COMMIT;
