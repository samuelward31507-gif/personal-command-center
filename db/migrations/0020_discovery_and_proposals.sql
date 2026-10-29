-- Discovery notes, next step and proposal tracking on deals; proposals stored as research artifacts.
-- Additive only: new nullable/defaulted columns and a widened CHECK. Nothing is deleted or rewritten.
BEGIN;
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS discovery jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS next_step text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_step_at date,
  ADD COLUMN IF NOT EXISTS proposal_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS proposal_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_decided_at timestamptz;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_proposal_status_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_proposal_status_check
  CHECK (proposal_status IN ('none','draft','sent','accepted','declined'));
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_discovery_object_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_discovery_object_check CHECK (jsonb_typeof(discovery) = 'object');

ALTER TABLE public.research_artifacts DROP CONSTRAINT IF EXISTS research_artifacts_artifact_type_check;
ALTER TABLE public.research_artifacts ADD CONSTRAINT research_artifacts_artifact_type_check
  CHECK (artifact_type IN ('prospect_research','call_brief','audit_prep','meeting_brief','follow_up_draft','proposal'));
COMMIT;
