-- Capture the form_check_submissions table in the migration history.
-- Stores client-submitted form-check videos and coach feedback.
-- The RLS policies for this table live in 007_form_checks_full_rls.sql —
-- that file is the source of truth for the policy set; this migration only
-- defines the table shape so rebuilding from migrations produces the correct
-- column set before 007 wires up row-level security.

create table if not exists public.form_check_submissions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.program_items(id) on delete set null,
  client_id uuid not null references public.profiles(id) on delete cascade,
  video_url text,
  client_note text,
  coach_feedback text,
  reviewed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_form_check_submissions_client_item
  on public.form_check_submissions (client_id, item_id, created_at desc);
