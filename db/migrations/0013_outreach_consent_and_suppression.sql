-- Outreach safety: explicit SMS consent and durable cross-channel suppression.
-- Existing contacts default to no SMS consent. Existing do-not-contact enrollments
-- are copied into the suppression ledger so they cannot be reactivated by UI/API.
BEGIN;
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent_source text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.contact_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'do_not_contact',
  source text NOT NULL DEFAULT 'crm',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id)
);
CREATE INDEX IF NOT EXISTS contact_suppressions_owner_idx
  ON public.contact_suppressions(owner_id, contact_id);
INSERT INTO public.contact_suppressions(owner_id, contact_id, reason, source)
SELECT owner_id, contact_id, 'do_not_contact', 'migration_existing_outreach'
FROM public.contact_outreach
WHERE status = 'do_not_contact'
ON CONFLICT (owner_id, contact_id) DO NOTHING;

-- Move existing active sequences off SMS-only steps when consent was never recorded.
-- They remain active and due now for the next permitted call step.
UPDATE public.contact_outreach o
SET current_step = o.current_step + 1,
    next_action_at = now(),
    updated_at = now()
FROM public.contacts c
WHERE c.id = o.contact_id
  AND c.owner_id = o.owner_id
  AND o.status = 'active'
  AND c.sms_consent = false
  AND o.current_step IN (3, 5);

COMMIT;
