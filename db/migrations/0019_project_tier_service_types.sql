-- Allow the Tier 1 / Tier 2 offer service types on delivery projects so a won tier
-- deal can be handed off. Additive: widens the allowed set only.
BEGIN;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_service_type_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_service_type_check CHECK (service_type = ANY (ARRAY[
  'tier1_speed_to_lead','tier2_revenue_system',
  'ai_voice_agent','speed_to_lead','lead_follow_up','appointment_booking','workflow_automation','custom_ai_implementation'
]::text[]));
COMMIT;
