CREATE TABLE IF NOT EXISTS public.contact_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('call', 'text', 'note')),
  action text NOT NULL CHECK (action IN ('outbound_call', 'outbound_text', 'note')),
  outcome text NOT NULL DEFAULT 'initiated' CHECK (outcome IN ('initiated', 'answered', 'no_answer', 'voicemail', 'reply_received', 'meeting_booked', 'completed', 'other')),
  notes text NOT NULL DEFAULT '',
  sequence_step smallint,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_activities_owner_contact_time_idx
  ON public.contact_activities (owner_id, contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS contact_activities_owner_time_idx
  ON public.contact_activities (owner_id, occurred_at DESC);
