-- Auditable AI workforce foundation. This stores configuration and human-entered/imported run records; it does not execute agents.
CREATE TABLE IF NOT EXISTS public.agent_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 name text NOT NULL,
 specialty text NOT NULL DEFAULT 'general',
 description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','paused','retired')),
 system_name text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,name)
);
CREATE TABLE IF NOT EXISTS public.agent_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 agent_id uuid REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
 agent_name text NOT NULL,
 task_title text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
 summary text NOT NULL DEFAULT '',
 result_text text NOT NULL DEFAULT '',
 cost_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
 started_at timestamptz,
 finished_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_runs_owner_status_idx ON public.agent_runs(owner_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS public.approval_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 action_type text NOT NULL DEFAULT 'other',
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
 decision_note text NOT NULL DEFAULT '',
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approval_requests_owner_status_idx ON public.approval_requests(owner_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS public.business_memory (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL,
 category text NOT NULL DEFAULT 'general' CHECK (category IN ('priority','preference','decision','lesson','customer','strategy','general')),
 title text NOT NULL,
 content text NOT NULL,
 importance smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
 source text NOT NULL DEFAULT 'manual',
 archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_memory_owner_category_idx ON public.business_memory(owner_id,archived,category,importance DESC,updated_at DESC);
