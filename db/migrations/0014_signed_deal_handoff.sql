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
CREATE INDEX IF NOT EXISTS deals_owner_agreement_status_idx
  ON public.deals(owner_id, agreement_status, effective_at, ended_at);
COMMIT;
