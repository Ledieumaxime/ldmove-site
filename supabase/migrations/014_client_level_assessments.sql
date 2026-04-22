-- Per-field coach validation of a client's declared level.
-- One row per (client_id, field_name). Coach fills these after watching the
-- assessment videos so the "real level" can differ from what the client
-- declared in the intake form.

create table if not exists public.client_level_assessments (
  client_id uuid not null references public.profiles(id) on delete cascade,
  field_name text not null,
  actual_value text,
  status text check (status in ('confirmed', 'partial', 'overestimated', 'underestimated')),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (client_id, field_name)
);

create index if not exists idx_client_level_assessments_client
  on public.client_level_assessments (client_id);

alter table public.client_level_assessments enable row level security;

-- Coach-only — the client must not see these internal notes.
drop policy if exists "cla_select_coach" on public.client_level_assessments;
create policy "cla_select_coach"
  on public.client_level_assessments for select to authenticated
  using (public.is_coach());

drop policy if exists "cla_insert_coach" on public.client_level_assessments;
create policy "cla_insert_coach"
  on public.client_level_assessments for insert to authenticated
  with check (public.is_coach());

drop policy if exists "cla_update_coach" on public.client_level_assessments;
create policy "cla_update_coach"
  on public.client_level_assessments for update to authenticated
  using (public.is_coach()) with check (public.is_coach());

drop policy if exists "cla_delete_coach" on public.client_level_assessments;
create policy "cla_delete_coach"
  on public.client_level_assessments for delete to authenticated
  using (public.is_coach());

-- Keep updated_at fresh on every change
create or replace function public.touch_client_level_assessments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_client_level_assessments on public.client_level_assessments;
create trigger trg_touch_client_level_assessments
  before update on public.client_level_assessments
  for each row execute function public.touch_client_level_assessments_updated_at();
