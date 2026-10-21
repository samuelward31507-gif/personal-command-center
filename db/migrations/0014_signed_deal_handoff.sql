-- Explicit signed-agreement state and idempotent sales-to-delivery/finance handoff.
BEGIN;
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS agreement_status text NOT NULL DEFAULT 'pending'
    CHECK (agreement_status IN ('pending','active','paused','ended')),
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS effective_at date,
  ADD COLUMN IF NOT EXISTS ended_at date,
  ADD COLUMN IF NOT EXISTS conversion_completed_at timestamptz;
ALTER TABLE public.revenue_entries
  ADD COLUMN IF NOT EXISTS source_key text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS revenue_entries_owner_source_key_unique_idx
  ON public.revenue_entries(owner_id, source_key) WHERE source_key <> '';
-- A pipeline deal already marked won is treated as a closed-won agreement.
UPDATE public.deals
SET agreement_status = 'active',
    signed_at = COALESCE(signed_at, updated_at),
    effective_at = COALESCE(effective_at, updated_at::date)
WHERE stage = 'won' AND agreement_status = 'pending';

-- Keep conversion idempotent even if the earlier handoff migration has not run yet.
CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_deal_unique_idx
  ON public.projects (owner_id, deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS deals_owner_agreement_status_idx
  ON public.deals(owner_id, agreement_status, effective_at, ended_at);
COMMIT;
