-- Client runtime: the live system for each client's customers. Threads and texts per customer phone,
-- quotes being followed up, and review requests. Additive only: four new tables.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'auto' CHECK (status IN ('auto','paused','opted_out','booked','closed')),
  last_in_at timestamptz,
  last_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, customer_phone)
);
CREATE INDEX IF NOT EXISTS client_threads_owner_idx ON public.client_threads (owner_id, project_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.client_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.client_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  author text NOT NULL DEFAULT 'customer' CHECK (author IN ('customer','ai','template','owner','system')),
  body text NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_texts_thread_idx ON public.client_texts (thread_id, at);
CREATE TABLE IF NOT EXISTS public.client_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  amount numeric(12,2),
  sent_on date NOT NULL,
  steps_sent integer NOT NULL DEFAULT 0,
  last_step_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','replied','won','lost','stopped')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_quotes_open_idx ON public.client_quotes (status, sent_on) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS public.client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
