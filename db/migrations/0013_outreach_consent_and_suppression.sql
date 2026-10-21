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
  contact_id uuid NOT NULL,
  email_normalized text NOT NULL DEFAULT '',
  phone_normalized text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT 'do_not_contact',
  source text NOT NULL DEFAULT 'crm',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id)
);
CREATE INDEX IF NOT EXISTS contact_suppressions_owner_idx
  ON public.contact_suppressions(owner_id, contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS contact_suppressions_owner_email_unique_idx
  ON public.contact_suppressions(owner_id, email_normalized) WHERE email_normalized <> '';
CREATE UNIQUE INDEX IF NOT EXISTS contact_suppressions_owner_phone_unique_idx
  ON public.contact_suppressions(owner_id, phone_normalized) WHERE phone_normalized <> '';
INSERT INTO public.contact_suppressions(owner_id, contact_id, email_normalized, phone_normalized, reason, source)
SELECT o.owner_id, o.contact_id, lower(trim(c.email)),
       regexp_replace(c.phone, '[^0-9]', '', 'g'),
       'do_not_contact', 'migration_existing_outreach'
FROM public.contact_outreach o
JOIN public.contacts c ON c.id = o.contact_id AND c.owner_id = o.owner_id
WHERE o.status = 'do_not_contact'
ON CONFLICT DO NOTHING;

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
