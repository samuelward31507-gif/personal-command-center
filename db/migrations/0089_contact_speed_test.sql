-- Speed test: Sam asks a prospect for a quote like a homeowner would and times their reply.
-- One jsonb per contact: { via: "form" | "call" | "text", at, repliedAt }. Additive only.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS speed_test jsonb;
