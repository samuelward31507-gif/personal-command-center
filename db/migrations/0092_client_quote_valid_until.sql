-- How long a quote's prices hold: set when the link first goes out (the owner's "quotes are good for N days"), pushed
-- out when the owner extends it. Past it, the customer can't approve old prices; they text for an updated quote.
-- NULL = no end date (the setting is off, or the quote went out before it was on). Additive only.
ALTER TABLE public.client_quotes ADD COLUMN IF NOT EXISTS valid_until date;
