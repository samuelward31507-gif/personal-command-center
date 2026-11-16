-- Switching over: photos attached to a customer in Jobber. Jobber's file links are signed and expire, so they're
-- downloaded during the pull and held here until the import puts them on the customer's record (client_photos),
-- then deleted from here. Additive only.
CREATE TABLE IF NOT EXISTS public.client_import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL,
  project_id uuid NOT NULL,
  customer_ref text NOT NULL,                              -- the source system's customer ref ("jobber:...")
  name text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'image/jpeg',
  bytes bytea NOT NULL,
  size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_import_files_ref_idx ON public.client_import_files (import_id, customer_ref);
