-- Pipeline stages that match how the agency actually sells:
-- new → contacted → meeting_booked → meeting_held → proposal → won / lost / nurture.
-- Existing deals are remapped (qualified→contacted, discovery→meeting_booked,
-- negotiation→proposal); nothing is deleted.
BEGIN;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_stage_check;
UPDATE public.deals SET stage = CASE stage
    WHEN 'qualified' THEN 'contacted'
    WHEN 'discovery' THEN 'meeting_booked'
    WHEN 'negotiation' THEN 'proposal'
    ELSE stage END,
  updated_at = now()
WHERE stage IN ('qualified','discovery','negotiation');
ALTER TABLE public.deals ADD CONSTRAINT deals_stage_check CHECK (stage = ANY (ARRAY[
  'new','contacted','meeting_booked','meeting_held','proposal','won','lost','nurture'
]::text[]));
COMMIT;
