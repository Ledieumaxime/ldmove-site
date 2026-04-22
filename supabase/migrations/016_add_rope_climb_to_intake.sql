-- Add a rope-climb ability field so the assessment-video upload can filter
-- the rope-climb slot for clients who can't do it arms-only.

alter table public.client_intakes
  add column if not exists rope_climb text;
