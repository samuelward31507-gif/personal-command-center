-- How the customer rated the finished job, from their page: 1 to 5 and a comment. One per job; the latest counts. Additive only.
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_feedback_project_idx ON public.client_feedback (project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS client_feedback_thread_idx ON public.client_feedback (thread_id);
