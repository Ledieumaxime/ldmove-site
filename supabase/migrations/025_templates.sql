-- Coach-managed templates (warm-up + workout) for the program editor.
--
-- The editor lets the coach attach a stack of prescribed exercises to
-- the active session in one click. Until now those stacks lived in a
-- markdown file shipped with the front-end bundle, which meant
-- editing them required a redeploy. From here, the source of truth is
-- this table; the .md files are dumped from it for off-line archival
-- via scripts/dump-templates-to-md.mjs.

-- Discriminator so the same table holds both warm-up and workout
-- templates without needing two parallel tables and join logic.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'template_type') then
    create type public.template_type as enum ('warmup', 'workout');
  end if;
end$$;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  type public.template_type not null,
  name text not null,
  description text,
  -- exercises shape (one row per exercise):
  --   { name, sets, reps, tempo, load, rest_seconds, group_name }
  -- group_name = null for single exercises, "Superset 1" / "Drop set 1"
  -- / "SPINE MOBILITY" / etc. for grouped ones. Matches the program_items
  -- group_name semantics so applying a template maps 1:1.
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_type_idx on public.templates (type);
create index if not exists templates_name_idx on public.templates (lower(name));

-- Keep updated_at fresh on each PATCH from the editor.
create or replace function public.set_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
before update on public.templates
for each row execute function public.set_templates_updated_at();

-- RLS: only the coach can read / write templates. Clients have no
-- business seeing or editing them.
alter table public.templates enable row level security;

drop policy if exists "Coach manages templates" on public.templates;
create policy "Coach manages templates" on public.templates
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'coach'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'coach'
    )
  );
