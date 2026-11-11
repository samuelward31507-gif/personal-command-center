-- Content at 5 posts + 5 reels a day: a slot number per day, a publish queue for Facebook and Instagram,
-- and the rendered images and videos those platforms fetch by URL. Additive only.
BEGIN;
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS n smallint NOT NULL DEFAULT 0;
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS angle text NOT NULL DEFAULT '';
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT '';  -- '' | queued | publishing | published | failed
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS publish_error text NOT NULL DEFAULT '';
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS fb_post_id text NOT NULL DEFAULT '';
ALTER TABLE public.content_drafts ADD COLUMN IF NOT EXISTS ig_post_id text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.content_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id text NOT NULL,
  draft_id uuid NOT NULL,
  idx smallint NOT NULL DEFAULT 0,          -- slide number for carousels
  mime text NOT NULL,
  bytes bytea NOT NULL,
  token text NOT NULL,                       -- unguessable; the public URL carries it
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, idx)
);
CREATE INDEX IF NOT EXISTS content_drafts_queue_idx ON public.content_drafts (scheduled_at) WHERE publish_status = 'queued';
COMMIT;
