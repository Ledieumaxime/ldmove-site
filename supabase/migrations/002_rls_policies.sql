-- Row Level Security — run AFTER 001_schema.sql

-- Helper: is the current user a coach?
create or replace function public.is_coach()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach'
  );
$$;

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_weeks enable row level security;
alter table public.program_items enable row level security;
alter table public.enrollments enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles: read own or if coach"
  on public.profiles for select
  using (id = auth.uid() or public.is_coach());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: coach can update anyone"
  on public.profiles for update
  using (public.is_coach());

-- exercises (shared library): everyone authenticated can read, only coach can write
create policy "exercises: all authenticated read"
  on public.exercises for select
  using (auth.role() = 'authenticated');

create policy "exercises: coach write"
  on public.exercises for all
  using (public.is_coach())
  with check (public.is_coach());

-- programs
-- Catalogue programs (published) are readable by any authenticated user
-- Custom programs are readable only by the assigned client or the coach
create policy "programs: read accessible"
  on public.programs for select
  using (
    public.is_coach()
    or (type = 'catalogue' and is_published = true)
    or (type = 'custom' and assigned_client_id = auth.uid())
  );

create policy "programs: coach write"
  on public.programs for all
  using (public.is_coach())
  with check (public.is_coach());

-- program_weeks: readable if the parent program is readable
create policy "program_weeks: read via program"
  on public.program_weeks for select
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (
          public.is_coach()
          or (p.type = 'catalogue' and p.is_published = true)
          or (p.type = 'custom' and p.assigned_client_id = auth.uid())
        )
    )
  );

create policy "program_weeks: coach write"
  on public.program_weeks for all
  using (public.is_coach())
  with check (public.is_coach());

-- program_items: same logic via week → program
create policy "program_items: read via week"
  on public.program_items for select
  using (
    exists (
      select 1 from public.program_weeks w
      join public.programs p on p.id = w.program_id
      where w.id = week_id
        and (
          public.is_coach()
          or (p.type = 'catalogue' and p.is_published = true)
          or (p.type = 'custom' and p.assigned_client_id = auth.uid())
        )
    )
  );

create policy "program_items: coach write"
  on public.program_items for all
  using (public.is_coach())
  with check (public.is_coach());

-- enrollments: client reads own, coach reads all
create policy "enrollments: read own or coach"
  on public.enrollments for select
  using (client_id = auth.uid() or public.is_coach());

create policy "enrollments: insert own (starts pending)"
  on public.enrollments for insert
  with check (client_id = auth.uid());

create policy "enrollments: coach full write"
  on public.enrollments for all
  using (public.is_coach())
  with check (public.is_coach());

-- notifications: user reads own, coach reads all
create policy "notifications: read own or coach"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_coach());

create policy "notifications: user marks own read"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "notifications: coach write"
  on public.notifications for all
  using (public.is_coach())
  with check (public.is_coach());
