-- Client intake form — native replacement for the Google Form used until now.
-- One row per client, keyed on client_id so a client can only have a single
-- active intake (updated in place if they need to edit).

create table if not exists public.client_intakes (
  client_id uuid primary key references public.profiles(id) on delete cascade,

  -- Section 1: Basic info
  first_name text,
  last_name text,
  age int,
  weight_kg numeric,
  height_cm numeric,
  injuries text,
  days_per_week text,
  session_length text,
  sport_background text,

  -- Section 2: Training history
  consistency text,
  current_training text[] default '{}',
  sessions_per_week text,

  -- Section 3: Base strength
  max_pull_ups text,
  max_dips text,
  max_push_ups text,
  deep_squat text,

  -- Section 4: Skills
  handstand text,
  muscle_up text,
  planche text,
  front_lever text,
  lsit_vsit text,
  hspu text,

  -- Section 5: Mobility
  hamstrings text,
  splits text[] default '{}',
  shoulder_mobility text,
  squat_flat_heels text,
  backbend text,

  -- Section 6: Goals
  main_goal text,
  specific_skills text[] default '{}',
  timeframe text,
  additional_info text,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_intakes enable row level security;

drop policy if exists "client_intakes: select own or coach" on public.client_intakes;
create policy "client_intakes: select own or coach"
  on public.client_intakes for select to authenticated
  using (client_id = auth.uid() or public.is_coach());

drop policy if exists "client_intakes: insert own" on public.client_intakes;
create policy "client_intakes: insert own"
  on public.client_intakes for insert to authenticated
  with check (client_id = auth.uid());

drop policy if exists "client_intakes: update own" on public.client_intakes;
create policy "client_intakes: update own"
  on public.client_intakes for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Keep updated_at fresh automatically
create or replace function public.touch_client_intakes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_client_intakes on public.client_intakes;
create trigger trg_touch_client_intakes
  before update on public.client_intakes
  for each row execute function public.touch_client_intakes_updated_at();
