-- Website and chat assistant clients get their own kickoff checklist (tier 'web').
-- Widens the allowed tier values only. No rows or columns change.
BEGIN;
ALTER TABLE public.kickoff_requests DROP CONSTRAINT IF EXISTS kickoff_requests_tier_check;
ALTER TABLE public.kickoff_requests ADD CONSTRAINT kickoff_requests_tier_check CHECK (tier IN ('tier1','tier2','web'));
COMMIT;
