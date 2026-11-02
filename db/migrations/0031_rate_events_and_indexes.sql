-- Rate limiting for public and AI endpoints: a kind, a hashed key and a time. No content is stored.
CREATE TABLE IF NOT EXISTS public.rate_events (id bigserial PRIMARY KEY, kind text NOT NULL, key_hash text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS rate_events_kind_key_at_idx ON public.rate_events (kind, key_hash, at);
-- Foreign-key lookups used by the client portal, client hub, money plan and meeting prep.
CREATE INDEX IF NOT EXISTS revenue_entries_owner_project_idx ON public.revenue_entries (owner_id, project_id);
CREATE INDEX IF NOT EXISTS revenue_entries_owner_deal_idx ON public.revenue_entries (owner_id, deal_id);
CREATE INDEX IF NOT EXISTS revenue_entries_owner_contact_idx ON public.revenue_entries (owner_id, contact_id);
CREATE INDEX IF NOT EXISTS calendar_events_owner_contact_idx ON public.calendar_events (owner_id, contact_id);
CREATE INDEX IF NOT EXISTS calendar_events_owner_deal_idx ON public.calendar_events (owner_id, deal_id);
