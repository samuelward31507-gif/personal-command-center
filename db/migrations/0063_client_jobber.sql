-- A client's Jobber account: every estimate Cinder books also lands in Jobber as a request on the customer's record.
-- Additive only: one new table and one new column.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_jobber (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  refresh_token_enc text NOT NULL,
  access_token_enc text NOT NULL DEFAULT '',
  access_expires_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  last_push_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS jobber_request_id text NOT NULL DEFAULT '';
COMMIT;
