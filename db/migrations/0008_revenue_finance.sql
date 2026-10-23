-- Additive finance foundation for the Cinder personal business CRM.
CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  revenue_type text NOT NULL DEFAULT 'other' CHECK (revenue_type IN ('setup_fee','monthly_retainer','usage','one_time','other')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','paid','overdue','cancelled')),
  due_date date,
  paid_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS revenue_entries_owner_status_due_idx ON public.revenue_entries(owner_id,status,due_date);
CREATE INDEX IF NOT EXISTS revenue_entries_owner_paid_idx ON public.revenue_entries(owner_id,paid_at DESC);
CREATE TABLE IF NOT EXISTS public.business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'software' CHECK (category IN ('software','marketing','contractor','telecom','hosting','education','equipment','travel','fees','taxes','other')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recurring boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_expenses_owner_date_idx ON public.business_expenses(owner_id,expense_date DESC);
