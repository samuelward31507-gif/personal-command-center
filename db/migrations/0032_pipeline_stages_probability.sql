-- Pipeline stages from the platform directive: Qualified, Interested and Negotiation return (superset of the old list;
-- no existing row changes). Optional per-deal close probability (0-100) overrides the stage default.
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_stage_check CHECK (stage = ANY (ARRAY['new','qualified','contacted','interested','meeting_booked','meeting_held','proposal','negotiation','won','lost','nurture']));
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS probability smallint CHECK (probability IS NULL OR (probability BETWEEN 0 AND 100));
