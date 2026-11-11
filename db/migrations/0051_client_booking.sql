-- Booking on the client's own Google Calendar, reminders and no-shows, Spanish threads, the owner's Monday text.
-- Additive only: three new tables and one new column.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_calendars (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  google_email text NOT NULL DEFAULT '',
  refresh_token_enc text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  slot_min integer NOT NULL DEFAULT 60,
  connected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.client_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.client_threads(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  event_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','done','no_show','canceled')),
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_appointments_due_idx ON public.client_appointments (starts_at) WHERE status = 'booked';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'en';
CREATE TABLE IF NOT EXISTS public.client_weekly (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, week)
);
COMMIT;
