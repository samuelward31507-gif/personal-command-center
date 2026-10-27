-- Add durable social profile URLs to Cinder contacts.
-- Additive and safe for existing records; no external messaging integration is enabled.
BEGIN;
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS instagram_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook_url text NOT NULL DEFAULT '';
COMMIT;
