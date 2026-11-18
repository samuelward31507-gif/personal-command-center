-- Keys for the agent API made in Settings (Grok Bot). Only a hash is stored; the key is shown once. Additive.
BEGIN;
CREATE TABLE IF NOT EXISTS public.agent_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  last4 text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT 'Grok Bot',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_keys_owner_idx ON public.agent_keys(owner_id, created_at DESC);
COMMIT;
