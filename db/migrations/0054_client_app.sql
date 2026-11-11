-- The Cinder app for client owners: one-time sign-in codes sent by text. Additive only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,                 -- 10 digits
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_codes_phone_idx ON public.app_codes (phone, created_at DESC);
COMMIT;
