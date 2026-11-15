-- The client CRM: a stage the owner can set, job details in the trade's own words, a job value and notes,
-- all on the customer's existing conversation row. Additive only: every column has a default or is nullable.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS value numeric;
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS stage_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_threads_stage_check') THEN
    ALTER TABLE public.client_threads ADD CONSTRAINT client_threads_stage_check CHECK (stage IS NULL OR stage IN ('new','booked','quoted','won','lost'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS client_threads_board_idx ON public.client_threads (project_id, updated_at DESC);
