-- Evidence-backed research and meeting preparation artifacts for the internal agency CRM.
BEGIN;
CREATE TABLE IF NOT EXISTS public.research_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  artifact_type text NOT NULL DEFAULT 'prospect_research'
    CHECK (artifact_type IN ('prospect_research','call_brief','audit_prep','meeting_brief','follow_up_draft')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_urls) = 'array'),
  verified_facts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(verified_facts) = 'array'),
  hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(hypotheses) = 'array'),
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','archived')),
  researched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_artifacts_owner_updated_idx
  ON public.research_artifacts(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS research_artifacts_owner_contact_idx
  ON public.research_artifacts(owner_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS research_artifacts_owner_deal_idx
  ON public.research_artifacts(owner_id, deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS research_artifacts_owner_event_idx
  ON public.research_artifacts(owner_id, calendar_event_id) WHERE calendar_event_id IS NOT NULL;
COMMIT;
