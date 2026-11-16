-- Leads by email: each business gets a forwarding address (<website key>@<inbound domain>). Lead emails from Angi,
-- Thumbtack, Google, Yelp and website forms land here, one row per email, and become leads when they carry a phone.
-- Emails without a phone wait for the owner. The message ID keeps a retried webhook from making a second lead. Additive only.
CREATE TABLE IF NOT EXISTS public.client_lead_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  message_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  from_addr text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',                         -- angi | thumbtack | google | yelp | web form | email | ...
  status text NOT NULL DEFAULT 'new',                      -- lead | no_phone | added | confirm | ignored | new
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',                           -- a mail provider's forwarding confirmation code
  link text NOT NULL DEFAULT '',                           -- and its confirmation link
  why text NOT NULL DEFAULT '',
  thread_id uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS client_lead_mail_msg_idx ON public.client_lead_mail (project_id, message_id);
CREATE INDEX IF NOT EXISTS client_lead_mail_recent_idx ON public.client_lead_mail (project_id, received_at DESC);
