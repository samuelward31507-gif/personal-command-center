-- Texting consent log for every client: how each number reached the business, and every opt-out / opt-in.
-- This is the record carriers and TCPA reviews ask for. Additive only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phone text NOT NULL,
  event text NOT NULL CHECK (event IN ('inbound_call','inbound_text','web_form','paid_lead','owner_import','opt_out','opt_in','help')),
  source text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_consent_project_idx ON public.client_consent (project_id, at DESC);
CREATE INDEX IF NOT EXISTS client_consent_phone_idx ON public.client_consent (project_id, phone);
COMMIT;
