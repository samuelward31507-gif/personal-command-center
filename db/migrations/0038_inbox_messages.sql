-- Instagram and Facebook Page DMs, delivered by Meta's webhook. Alerts only: the conversation stays in Meta's inbox.
CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('instagram', 'facebook')),
  sender_id text NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  mid text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  UNIQUE (owner_id, mid)
);
CREATE INDEX IF NOT EXISTS inbox_messages_unseen ON public.inbox_messages (owner_id, seen_at, received_at DESC);
