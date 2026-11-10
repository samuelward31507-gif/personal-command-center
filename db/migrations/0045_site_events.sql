-- Website analytics for cinderrevenue.com: anonymous visitor/session ids (no cookies), page views, clicks, demo plays.
CREATE TABLE IF NOT EXISTS public.site_events (
  id bigserial PRIMARY KEY,
  owner_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  vid text NOT NULL,
  sid text NOT NULL,
  type text NOT NULL CHECK (type IN ('view', 'click', 'play', 'leave', 'calc')),
  path text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  ref text NOT NULL DEFAULT '',
  utm_source text NOT NULL DEFAULT '',
  utm_medium text NOT NULL DEFAULT '',
  utm_campaign text NOT NULL DEFAULT '',
  who_name text NOT NULL DEFAULT '',
  who_company text NOT NULL DEFAULT '',
  ms int,
  country text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  mobile boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS site_events_owner_at ON public.site_events (owner_id, at DESC);
