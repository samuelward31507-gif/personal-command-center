-- Crew assignment on jobs and estimates, the customer's choice on quotes with options, and email delivery stamps.
-- Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS crew_member text NOT NULL DEFAULT '';        -- a team member's +1 cell, '' = the owner
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS crew_member text NOT NULL DEFAULT '';
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS items_offered jsonb;                            -- every option as offered, kept after the customer picks
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS choice jsonb;                                   -- { tier, addons } the customer approved
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS emailed_at timestamptz;
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS emailed_at timestamptz;
