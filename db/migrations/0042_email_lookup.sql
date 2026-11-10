-- Website email lookup: when we last looked for an email on the contact's website (so each site is checked once).
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_lookup_at timestamptz;
