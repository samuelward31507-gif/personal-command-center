-- Add first-class social profile URLs for CRM contacts.
-- Additive and safe for existing records; existing contacts remain unchanged.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook text NOT NULL DEFAULT '';
