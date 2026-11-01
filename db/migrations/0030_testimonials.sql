-- Testimonials: a private link a client uses to leave a quote, with explicit permission to publish.
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','submitted')),
  quote text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  permission boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS testimonials_owner_idx ON public.testimonials (owner_id, project_id);
