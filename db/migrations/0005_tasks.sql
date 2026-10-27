CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_at timestamptz,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_owner_status_due_idx ON public.tasks (owner_id, status, due_at);
CREATE INDEX IF NOT EXISTS tasks_owner_updated_idx ON public.tasks (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tasks_owner_contact_idx ON public.tasks (owner_id, contact_id);
CREATE INDEX IF NOT EXISTS tasks_owner_deal_idx ON public.tasks (owner_id, deal_id);
