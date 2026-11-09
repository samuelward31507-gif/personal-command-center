-- Content: a log of each Facebook page / Instagram post and TikTok / Reels video you mark posted.
-- post_key is a key from lib/content-posts.ts (ALL_POSTS); channel is 'page' or 'video'.
-- Additive only: one new table and one index. Nothing existing changes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.content_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id text NOT NULL,
  post_key text NOT NULL,
  channel text NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_posts_owner_posted_idx ON public.content_posts (owner_id, posted_at DESC);
COMMIT;
