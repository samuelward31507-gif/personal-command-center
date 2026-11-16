-- Who did what in the app (moved a job, sent an invoice, recorded or deleted a payment, changed settings), for shops
-- with more than one person in it. Kept a year. Additive only.
CREATE TABLE IF NOT EXISTS public.client_activity (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL DEFAULT '',                            -- the person's cell, "" = the owner
  role text NOT NULL DEFAULT '',
  action text NOT NULL,
  thread_id uuid,
  detail text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS client_activity_project_idx ON public.client_activity (project_id, at DESC);
