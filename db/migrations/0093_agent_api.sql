-- The agent API (Grok Bot): mark what an outside agent wrote, so it never passes for Sam's own work, and let a
-- draft be an email as well as a text. Additive and idempotent.
BEGIN;
ALTER TABLE public.research_artifacts ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'founder';
ALTER TABLE public.follow_up_drafts ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'cinder';
ALTER TABLE public.follow_up_drafts ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'text';
ALTER TABLE public.follow_up_drafts ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS research_artifacts_owner_author_idx
  ON public.research_artifacts(owner_id, author, contact_id, updated_at DESC) WHERE author <> 'founder';
COMMIT;
