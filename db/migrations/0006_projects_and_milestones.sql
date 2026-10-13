CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 240),
  client_name text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT 'custom_ai_implementation',
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','onboarding','in_progress','blocked','review','completed','on_hold','cancelled')),
  start_date date,
  target_date date,
  monthly_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_value >= 0),
  setup_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (setup_value >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_owner_status_updated_idx ON public.projects (owner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_owner_target_date_idx ON public.projects (owner_id, target_date);
CREATE INDEX IF NOT EXISTS projects_owner_contact_idx ON public.projects (owner_id, contact_id);
CREATE INDEX IF NOT EXISTS projects_owner_deal_idx ON public.projects (owner_id, deal_id);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done','cancelled')),
  due_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_milestones_owner_project_order_idx ON public.project_milestones (owner_id, project_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS project_milestones_owner_status_due_idx ON public.project_milestones (owner_id, status, due_at);
