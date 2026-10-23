-- Per-contact outbound prospecting sequence state. Additive migration; no existing records are deleted.
CREATE TABLE IF NOT EXISTS public.contact_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'parked', 'interested', 'meeting_booked', 'do_not_contact', 'completed')),
  current_step integer NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
  started_at timestamptz NOT NULL DEFAULT now(),
  next_action_at timestamptz NOT NULL DEFAULT now(),
  niche text NOT NULL DEFAULT '',
  pain_point text NOT NULL DEFAULT '',
  research_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id)
);
CREATE INDEX IF NOT EXISTS contact_outreach_due_idx
  ON public.contact_outreach (owner_id, status, next_action_at);
CREATE INDEX IF NOT EXISTS contact_outreach_contact_idx
  ON public.contact_outreach (owner_id, contact_id);
