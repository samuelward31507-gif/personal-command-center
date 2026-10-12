-- Client success, renewal tracking, and support inbox.
CREATE TABLE IF NOT EXISTS public.client_success (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
 project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
 client_name text NOT NULL,
 service_name text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('onboarding','active','at_risk','renewal_due','paused','churned')),
 health_score smallint NOT NULL DEFAULT 3 CHECK (health_score BETWEEN 1 AND 5),
 renewal_date date,
 monthly_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_value >= 0),
 goals text NOT NULL DEFAULT '',
 results text NOT NULL DEFAULT '',
 risk_notes text NOT NULL DEFAULT '',
 next_review_date date,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_success_owner_status_renewal_idx ON public.client_success(owner_id,status,renewal_date);
CREATE TABLE IF NOT EXISTS public.support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 client_success_id uuid REFERENCES public.client_success(id) ON DELETE SET NULL,
 contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
 project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_on_client','resolved','closed')),
 due_date date,
 resolution_notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_owner_status_priority_idx ON public.support_tickets(owner_id,status,priority,created_at DESC);
