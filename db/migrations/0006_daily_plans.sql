CREATE TABLE IF NOT EXISTS public.daily_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 plan_date date NOT NULL,
 completed_blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(completed_blocks) = 'array'),
 notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (owner_id, plan_date)
);
CREATE INDEX IF NOT EXISTS daily_plans_owner_date_idx ON public.daily_plans (owner_id, plan_date DESC);