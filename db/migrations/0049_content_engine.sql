-- Content engine: posts Cinder writes for you each week, one row per post per platform.
-- Each row keeps its numbers once posted (views, comments, leads) so the engine learns what works.
-- Additive only: one new table and two indexes. Nothing existing changes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.content_drafts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id text NOT NULL,
  week date NOT NULL,                       -- Monday of the week it's planned for
  day smallint NOT NULL DEFAULT 0,          -- 0 = Monday … 6 = Sunday
  platform text NOT NULL,                   -- feed | video | linkedin | group | x | gbp
  pillar text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT 'post',      -- post | carousel | video | thread
  hook text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  card jsonb NOT NULL DEFAULT '{}'::jsonb,  -- what the image says
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  shoot text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',     -- draft | posted | skipped
  posted_at timestamptz,
  url text NOT NULL DEFAULT '',
  views integer,
  comments integer,
  leads integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_drafts_owner_week_idx ON public.content_drafts (owner_id, week, day);
CREATE INDEX IF NOT EXISTS content_drafts_owner_posted_idx ON public.content_drafts (owner_id, posted_at DESC) WHERE status = 'posted';
COMMIT;
