-- Allow the "not a fit" and "wrong contact" call outcomes that the outreach UI and
-- /api/contacts/outcome already offer. Additive: widens the allowed set only.
BEGIN;
ALTER TABLE public.contact_activities DROP CONSTRAINT IF EXISTS contact_activities_outcome_check;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_outcome_check CHECK (outcome = ANY (ARRAY[
  'initiated','answered','connected','no_answer','voicemail','callback_requested','reply_received',
  'interested','meeting_booked','not_a_fit','wrong_contact','do_not_contact','completed','other'
]::text[]));
COMMIT;
