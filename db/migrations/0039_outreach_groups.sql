-- Facebook groups you post in, and each post. Leads from a group are contacts with source 'Facebook group: <name>'.
CREATE TABLE IF NOT EXISTS public.outreach_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  url text NOT NULL DEFAULT '',
  rules text NOT NULL DEFAULT '',
  every_days integer NOT NULL DEFAULT 7 CHECK (every_days BETWEEN 1 AND 60),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.outreach_groups(id) ON DELETE CASCADE,
  script text NOT NULL DEFAULT '',
  posted_at timestamptz NOT NULL DEFAULT now()
);
