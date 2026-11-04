-- Call mode v2: gatekeeper, wrong number, send info and not interested outcomes. Additive only.
ALTER TABLE public.contact_activities DROP CONSTRAINT IF EXISTS contact_activities_outcome_check;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_outcome_check CHECK (outcome = ANY (ARRAY[
  'initiated','answered','connected','no_answer','voicemail','callback_requested','reply_received','interested','meeting_booked',
  'not_a_fit','wrong_contact','do_not_contact','completed','other','gatekeeper','wrong_number','send_info','not_interested']));
