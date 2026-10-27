-- Make sales-to-delivery handoff idempotent even when retries race.
-- The application also checks for existing rows and returns them on conflict.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_deal_unique_idx
  ON public.projects (owner_id, deal_id)
  WHERE deal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_milestones_owner_project_title_unique_idx
  ON public.project_milestones (owner_id, project_id, lower(btrim(title)));

COMMIT;
