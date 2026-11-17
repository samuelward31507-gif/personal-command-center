-- Expenses and mileage: what the business spends (materials, fuel, dump fees, permits, subs), with the receipt
-- photo, optionally tied to a job so job costing sees it. Mileage is a trip in miles at the owner's rate. Additive only.
CREATE TABLE IF NOT EXISTS public.client_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  thread_id uuid,                                          -- the job it was for, if any
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'mileage')),
  vendor text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL CHECK (amount >= 0),
  miles numeric,
  spent_on date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '',
  member text NOT NULL DEFAULT '',                         -- who logged it ("" = the owner)
  receipt bytea,
  receipt_mime text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_expenses_project_idx ON public.client_expenses (project_id, spent_on DESC);
CREATE INDEX IF NOT EXISTS client_expenses_thread_idx ON public.client_expenses (thread_id);
