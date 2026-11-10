-- Meeting outcomes (showed / no_show / rescheduled / cancelled), agreement views, and Autopilot settings.
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS outcome_at timestamptz;
ALTER TABLE public.signing_requests ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
CREATE TABLE IF NOT EXISTS public.autopilot (
  owner_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  per_day int NOT NULL DEFAULT 40,
  last_run jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
