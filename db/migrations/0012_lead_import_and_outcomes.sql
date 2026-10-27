-- Supports lead-spreadsheet imports (business website/location research
-- fields) and extends the outreach call-outcome taxonomy to match the real
-- calling workflow. Additive and backward compatible: no existing columns,
-- rows, or constraint values are removed.
BEGIN;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';

-- Speeds up server-side duplicate detection during bulk import.
CREATE INDEX IF NOT EXISTS contacts_owner_email_lower_idx
  ON public.contacts (owner_id, lower(email)) WHERE email <> '';

-- Add the new call-outcome values used by the calling workflow
-- (connected, callback requested, interested, do-not-contact) while
-- preserving every previously valid value already stored on existing rows.
ALTER TABLE public.contact_activities DROP CONSTRAINT contact_activities_outcome_check;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_outcome_check
  CHECK (outcome IN (
    'initiated', 'answered', 'connected', 'no_answer', 'voicemail',
    'callback_requested', 'reply_received', 'interested', 'meeting_booked',
    'do_not_contact', 'completed', 'other'
  ));

COMMIT;
