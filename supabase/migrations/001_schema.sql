-- LD Move — initial schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)

-- 1. profiles: extends auth.users with role + name
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  role text not null default 'client' check (role in ('coach', 'client')),
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. exercises: shared video library
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  video_url text,
  description text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

-- 3. programs
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_image_url text,
  type text not null check (type in ('catalogue', 'custom')),
  owner_coach_id uuid references public.profiles(id) on delete set null,
  assigned_client_id uuid references public.profiles(id) on delete set null,
  price_eur numeric(10, 2) not null default 0,
  billing_type text not null check (billing_type in ('one_time', 'subscription')),
  subscription_months int,
  duration_weeks int,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4. program_weeks
create table public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_number int not null,
  title text,
  notes text,
  unique (program_id, week_number)
);

-- 5. program_items (exercises inside a week)
create table public.program_items (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.program_weeks(id) on delete cascade,
  order_index int not null default 0,
  exercise_id uuid references public.exercises(id) on delete set null,
  custom_name text,
  sets int,
  reps text,
  rest_seconds int,
  notes text,
  video_url text
);

-- 6. enrollments (client enrolled in a program)
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid', 'active', 'completed', 'canceled')),
  stripe_session_id text,
  stripe_subscription_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (program_id, client_id)
);

-- 7. notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_programs_assigned_client on public.programs(assigned_client_id);
create index idx_programs_type on public.programs(type);
create index idx_enrollments_client on public.enrollments(client_id);
create index idx_notifications_user_read on public.notifications(user_id, read);

-- Auto-create a profile row when a new auth.users row is created (signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
