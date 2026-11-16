-- The owner's own fields on every customer (gate code, HOA name, dog's name, PO number): the labels live in the
-- business's setup, the values here. Additive only.
ALTER TABLE public.client_threads ADD COLUMN IF NOT EXISTS custom jsonb NOT NULL DEFAULT '{}'::jsonb;
