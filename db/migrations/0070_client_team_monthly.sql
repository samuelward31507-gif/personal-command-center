-- The monthly report text, sent once per business per month. Additive only.
CREATE TABLE IF NOT EXISTS public.client_monthly (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month date NOT NULL,                      -- the first of the month the report covers
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, month)
);
