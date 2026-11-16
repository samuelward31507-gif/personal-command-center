-- Three things the big field-service CRMs keep that Cinder didn't. Additive only.

-- Equipment at a customer's address (a furnace, a water heater, a pool pump, a generator): what it is, the serial,
-- when it went in, when the warranty runs out, and each service.
CREATE TABLE IF NOT EXISTS public.client_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,                                 -- the customer
  kind text NOT NULL DEFAULT '',                           -- "Furnace", "Water heater"
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  serial text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',                       -- "Basement", "Side yard"
  installed_on date,
  warranty_until date,
  notes text NOT NULL DEFAULT '',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,              -- [{ on, note, by }] newest first
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
CREATE INDEX IF NOT EXISTS client_equipment_thread_idx ON public.client_equipment (thread_id);

-- Documents kept with a job: permits, contracts, drawings, inspection reports.
CREATE TABLE IF NOT EXISTS public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'application/pdf',
  bytes bytea NOT NULL,
  size integer NOT NULL DEFAULT 0,
  member text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_files_thread_idx ON public.client_files (thread_id, created_at);

-- The office's to-dos: a due date, who it's for, optionally a customer.
CREATE TABLE IF NOT EXISTS public.client_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  title text NOT NULL,
  due_on date,
  assignee text NOT NULL DEFAULT '',                       -- a team cell, "" = the owner
  thread_id uuid,
  done_at timestamptz,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_tasks_project_idx ON public.client_tasks (project_id, done_at, due_on);
