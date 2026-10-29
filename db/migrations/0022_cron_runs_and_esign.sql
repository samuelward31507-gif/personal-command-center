-- A record of every scheduled-job run (and refused cron call) so a silent night is visible.
-- Additive only: one new table.
BEGIN;
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  trigger text NOT NULL DEFAULT 'cron',
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS cron_runs_job_started_idx ON public.cron_runs (job, started_at DESC);
COMMIT;

-- E-signature links for service agreements. The token itself is never stored, only its SHA-256.
BEGIN;
CREATE TABLE IF NOT EXISTS public.signing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  artifact_id uuid NOT NULL REFERENCES public.research_artifacts(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','signed','void')),
  provider_name text NOT NULL DEFAULT '',
  provider_signer text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  signed_at timestamptz,
  signer_name text,
  signer_title text,
  signer_email text,
  signer_ip text,
  signer_user_agent text,
  signed_content text
);
CREATE INDEX IF NOT EXISTS signing_requests_deal_idx ON public.signing_requests (owner_id, deal_id, created_at DESC);
COMMIT;
