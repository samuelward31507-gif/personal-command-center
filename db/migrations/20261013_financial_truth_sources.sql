-- Canonical source for contracted MRR and earned revenue.
-- Apply to an isolated Neon branch first; this migration is additive and idempotent.
ALTER TABLE public.revenue_entries
  ADD COLUMN IF NOT EXISTS recognized_date date;

CREATE TABLE IF NOT EXISTS public.recurring_revenue_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  client_name text NOT NULL,
  contract_name text NOT NULL,
  monthly_amount numeric NOT NULL CHECK (monthly_amount >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  start_date date NOT NULL,
  end_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_contract_dates_valid CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT recurring_contract_client_name_nonempty CHECK (length(trim(client_name)) BETWEEN 1 AND 240),
  CONSTRAINT recurring_contract_name_nonempty CHECK (length(trim(contract_name)) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS recurring_contracts_owner_status_dates_idx
  ON public.recurring_revenue_contracts (owner_id, status, start_date, end_date);
