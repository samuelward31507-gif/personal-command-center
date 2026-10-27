CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  event_type text NOT NULL DEFAULT 'meeting' CHECK (event_type IN ('meeting','call','focus','personal','deadline','other')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS calendar_events_owner_start_idx ON public.calendar_events (owner_id, starts_at);
CREATE INDEX IF NOT EXISTS calendar_events_owner_end_idx ON public.calendar_events (owner_id, ends_at);
