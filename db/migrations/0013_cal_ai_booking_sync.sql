-- Cal.com booking sync for Cinder's Cal.ai scheduling workflows.
-- Apply through the project's normal migration process before enabling the webhook.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_provider_event_unique
  ON public.calendar_events (owner_id, provider, provider_event_id)
  WHERE provider IS NOT NULL AND provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cal_ai_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  trigger_event text NOT NULL,
  processing_status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cal_ai_webhook_events_received_idx
  ON public.cal_ai_webhook_events (received_at DESC);
