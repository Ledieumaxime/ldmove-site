-- Workout logger: track each set the client actually does, per exercise per
-- session date. One row = one set. Multiple sessions of the same exercise
-- over time live as separate rows with different session_date values.
--
-- The reps_done field is interpreted in the unit the coach prescribed
-- ("3 x 10" -> 10 reps, "3 x 30s" -> 30 seconds). We don't enforce a unit
-- column; the coach's prescription on program_items.reps tells the client
-- what to put in.
--
-- weight_kg is optional (bodyweight exercises leave it null).

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  program_item_id uuid not null references public.program_items(id) on delete cascade,
  session_date date not null default current_date,
  set_number int not null check (set_number >= 1),
  reps_done int check (reps_done is null or reps_done >= 0),
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, program_item_id, session_date, set_number)
);

create index if not exists idx_workout_logs_client_item
  on public.workout_logs (client_id, program_item_id, session_date desc);

create index if not exists idx_workout_logs_client_date
  on public.workout_logs (client_id, session_date desc);

alter table public.workout_logs enable row level security;

-- The client owns their own logs.
drop policy if exists "workout_logs: select own or coach" on public.workout_logs;
create policy "workout_logs: select own or coach"
  on public.workout_logs for select to authenticated
  using (client_id = auth.uid() or public.is_coach());

drop policy if exists "workout_logs: insert own" on public.workout_logs;
create policy "workout_logs: insert own"
  on public.workout_logs for insert to authenticated
  with check (client_id = auth.uid());

drop policy if exists "workout_logs: update own" on public.workout_logs;
create policy "workout_logs: update own"
  on public.workout_logs for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "workout_logs: delete own" on public.workout_logs;
create policy "workout_logs: delete own"
  on public.workout_logs for delete to authenticated
  using (client_id = auth.uid());

-- Keep updated_at fresh on any change.
create or replace function public.touch_workout_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_workout_logs on public.workout_logs;
create trigger trg_touch_workout_logs
  before update on public.workout_logs
  for each row execute function public.touch_workout_logs_updated_at();
