-- Inbox sorter: the cold-email inbox's messages, sorted by Claude into what needs you (interested, questions,
-- meetings, follow-ups) and what doesn't. Headers and Gmail's short preview only, never full bodies.
CREATE TABLE IF NOT EXISTS public.gmail_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  message_id text NOT NULL,
  thread_id text NOT NULL DEFAULT '',
  from_addr text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'other',
  summary text NOT NULL DEFAULT '',
  next_step text NOT NULL DEFAULT '',
  contact_id uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, message_id)
);
