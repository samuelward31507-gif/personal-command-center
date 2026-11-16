-- The owner's own follow-ups ("3 days after a quote goes out, text this"): the rules live in the business's setup;
-- this records each rule's send to each customer, so nobody gets the same follow-up twice. Additive only.
CREATE TABLE IF NOT EXISTS public.client_auto_sends (
  project_id uuid NOT NULL,
  rule_id text NOT NULL,
  thread_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT false,
  PRIMARY KEY (project_id, rule_id, thread_id)
);
