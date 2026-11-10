-- Several sending inboxes per owner. Cold email rotates across them; each has its own daily cap.
ALTER TABLE public.gmail_accounts ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.gmail_accounts ADD COLUMN IF NOT EXISTS is_main boolean NOT NULL DEFAULT false;
ALTER TABLE public.gmail_accounts ADD COLUMN IF NOT EXISTS ramp boolean NOT NULL DEFAULT true;
ALTER TABLE public.gmail_accounts DROP CONSTRAINT IF EXISTS gmail_accounts_pkey;
ALTER TABLE public.gmail_accounts ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS gmail_accounts_owner_email ON public.gmail_accounts (owner_id, lower(email));
-- The inbox that was already connected is the main one and already has a sending history: no warm-up ramp.
UPDATE public.gmail_accounts SET is_main = true, ramp = false WHERE NOT EXISTS (SELECT 1 FROM public.gmail_accounts g2 WHERE g2.owner_id = gmail_accounts.owner_id AND g2.is_main);
-- Which inbox an email arrived in, so replies go out from the same address.
ALTER TABLE public.gmail_inbox ADD COLUMN IF NOT EXISTS account_email text;
