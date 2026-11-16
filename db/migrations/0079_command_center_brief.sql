-- Command center: the overnight brief and the follow-up finder. Additive only.

-- One written brief per owner per day, built at ~5am from what happened overnight.
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  day date NOT NULL,                                  -- the owner's local day the brief is for
  brief text NOT NULL DEFAULT '',                     -- 3-4 sentences; people appear as [[contact_id|Name]]
  calls jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{ contactId, reason }] ranked, at most 8
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,           -- what the brief was written from, so every line can be traced
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, day)
);

-- Follow-ups Cinder found and already wrote: someone went quiet after a text, a meeting or a proposal.
CREATE TABLE IF NOT EXISTS public.follow_up_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  contact_id uuid NOT NULL,
  pattern text NOT NULL,                              -- no_reply | after_meeting | proposal_quiet
  reason text NOT NULL DEFAULT '',                    -- one line shown above the draft
  body text NOT NULL DEFAULT '',                      -- the drafted text message
  status text NOT NULL DEFAULT 'ready',               -- ready | sent | skipped | expired
  snooze_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  acted_at timestamptz
);
CREATE INDEX IF NOT EXISTS follow_up_drafts_owner_status ON public.follow_up_drafts (owner_id, status, created_at DESC);
-- At most one open draft per person per pattern.
CREATE UNIQUE INDEX IF NOT EXISTS follow_up_drafts_one_open ON public.follow_up_drafts (owner_id, contact_id, pattern) WHERE status = 'ready';
