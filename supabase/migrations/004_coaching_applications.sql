-- Missing table used by the `send-coaching-application` edge function.
-- Without this table, every form submission fails and no email is sent.
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query).

create table if not exists public.coaching_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text default '',
  country text default '',
  goal text,
  level text default 'contact',
  duration text,
  message text,
  created_at timestamptz not null default now()
);

-- Helpful index for the coach dashboard (most recent first)
create index if not exists idx_coaching_applications_created
  on public.coaching_applications (created_at desc);

-- RLS: the edge function uses the service role key which bypasses RLS,
-- so we keep policies strict (only the coach can read from the client side).
alter table public.coaching_applications enable row level security;

create policy "coach can read applications"
  on public.coaching_applications
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coach'
  ));
