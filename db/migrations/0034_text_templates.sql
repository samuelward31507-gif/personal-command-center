-- Voicemail + info text templates. Additive only: nothing is dropped or rewritten.
-- Texts Sam sends from his phone are logged as contact_activities (channel 'text'):
--   outbound: action 'outbound_text', template 'T-VM' | 'T-INFO' | '' , notes = final body
--   inbound:  action 'inbound_text', outcome 'reply_received', notes = their reply
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT '';
ALTER TABLE public.contact_activities DROP CONSTRAINT IF EXISTS contact_activities_action_check;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_action_check
  CHECK (action = ANY (ARRAY['outbound_call', 'outbound_text', 'inbound_text', 'note']));
CREATE INDEX IF NOT EXISTS contact_activities_owner_contact_template_idx
  ON public.contact_activities (owner_id, contact_id, template) WHERE template <> '';

-- The prospect's IANA time zone (e.g. 'America/New_York'). Blank = work it out from state, then area code.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT '';
