-- Service agreement tracking on deals; agreements stored as research artifacts next to proposals.
-- Additive only: new defaulted columns and a widened CHECK. Nothing is deleted or rewritten.
BEGIN;
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS contract_sent_at timestamptz;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_contract_status_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_contract_status_check
  CHECK (contract_status IN ('none','draft','sent','signed'));

ALTER TABLE public.research_artifacts DROP CONSTRAINT IF EXISTS research_artifacts_artifact_type_check;
ALTER TABLE public.research_artifacts ADD CONSTRAINT research_artifacts_artifact_type_check
  CHECK (artifact_type IN ('prospect_research','call_brief','audit_prep','meeting_brief','follow_up_draft','proposal','agreement'));
COMMIT;
