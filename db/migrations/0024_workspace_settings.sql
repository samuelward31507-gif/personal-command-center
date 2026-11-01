-- Workspace settings: business identity, offer prices, goal and time zone, one row per owner.
-- Additive only: one new table. Existing tables are not touched. An owner with no row gets the built-in defaults.
BEGIN;
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  owner_id text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
