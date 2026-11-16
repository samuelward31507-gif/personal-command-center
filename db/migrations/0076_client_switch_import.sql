-- The switch-over center: moving a business in from Jobber, QuickBooks, Housecall Pro, ServiceTitan, a spreadsheet or
-- phone contacts. Every imported row keeps its source and the source's ID (a second import updates instead of duplicating),
-- each batch can be undone for 7 days, and customers can have more than one property. Additive only.
CREATE TABLE IF NOT EXISTS public.client_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  source text NOT NULL,                                    -- jobber | quickbooks | housecall | servicetitan | spreadsheet | contacts | none
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'done', 'undone', 'failed')),
  staged jsonb NOT NULL DEFAULT '{}'::jsonb,               -- everything read so far, in one plain shape
  decisions jsonb NOT NULL DEFAULT '{}'::jsonb,            -- merges the owner undid, phones the owner typed
  pull jsonb NOT NULL DEFAULT '{}'::jsonb,                 -- where an API pull is up to, and what it couldn't read
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,               -- where the import itself is up to
  result jsonb NOT NULL DEFAULT '{}'::jsonb,               -- created, updated, merged, skipped, by type
  progress integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS client_imports_project_idx ON public.client_imports (project_id, created_at DESC);

-- What a batch wrote, so it can be taken back: created rows go, updated rows get their old values back.
CREATE TABLE IF NOT EXISTS public.client_import_items (
  id bigserial PRIMARY KEY,
  import_id uuid NOT NULL,
  project_id uuid NOT NULL,
  target text NOT NULL,                                    -- threads | properties | quotes | invoices | payments | plans | catalog
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated')),
  before jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_import_items_import_idx ON public.client_import_items (import_id, id);

CREATE TABLE IF NOT EXISTS public.client_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  address text NOT NULL DEFAULT '',
  gate_code text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  source_system text NOT NULL DEFAULT '',
  source_ref text NOT NULL DEFAULT '',
  import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_properties_thread_idx ON public.client_properties (thread_id, created_at);

ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT '';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS source_ref text NOT NULL DEFAULT '';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS import_id uuid;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS hidden_at timestamptz;   -- an undone import hides its customers; nothing is deleted
CREATE INDEX IF NOT EXISTS client_threads_source_ref_idx ON public.client_threads (project_id, source_system, source_ref) WHERE source_ref <> '';

ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT '';
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS source_ref text NOT NULL DEFAULT '';
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS import_id uuid;
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS chase_paused boolean NOT NULL DEFAULT false;  -- imported quotes wait for the owner before Cinder follows up

ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT '';
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS source_ref text NOT NULL DEFAULT '';
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS import_id uuid;
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS import_id uuid;
ALTER TABLE public.client_plans ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT '';
ALTER TABLE public.client_plans ADD COLUMN IF NOT EXISTS source_ref text NOT NULL DEFAULT '';
ALTER TABLE public.client_plans ADD COLUMN IF NOT EXISTS import_id uuid;
