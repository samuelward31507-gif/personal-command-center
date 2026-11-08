-- Connected Gmail / Google Workspace inbox per owner, for sending cold email from the CRM.
-- The refresh token is stored encrypted (AES-256-GCM, key in CINDER_TOKEN_KEY); only the gmail.send scope is granted.
CREATE TABLE IF NOT EXISTS public.gmail_accounts (
  owner_id text PRIMARY KEY,
  email text NOT NULL,
  refresh_token_enc text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
