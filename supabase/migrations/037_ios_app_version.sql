-- Which version of the iPhone app each client runs, and the oldest one
-- still allowed to open.
--
-- The iPhone app carries its screens inside the build (Apple guideline
-- 4.2), so a fix only reaches a client once their phone has installed the
-- new version. On 2026-11-12 there was no way to tell who had: the only
-- clues were the date of a push token and whether form check videos
-- arrived compressed. From 1.0.3 the app reports its version on every
-- launch, and refuses to run below `ios_min_version`.

alter table public.profiles
  add column if not exists ios_app_version text,
  add column if not exists ios_app_seen_at timestamptz;

-- Settings read by the app before anyone signs in. Written with the
-- service key only: no insert / update / delete policy on purpose.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "app_config: anyone reads" on public.app_config;
create policy "app_config: anyone reads"
  on public.app_config for select
  using (true);

grant select on public.app_config to anon, authenticated;

-- 1.0.0 lets every version through. Raise it to force an update, e.g.
--   update app_config set value = '1.0.3', updated_at = now()
--   where key = 'ios_min_version';
-- Only builds from 1.0.3 read it: older ones cannot be forced.
insert into public.app_config (key, value)
values ('ios_min_version', '1.0.0')
on conflict (key) do nothing;

-- The app reports its version for the person signed in, and only for
-- them: SECURITY DEFINER so it does not depend on which profile columns
-- the "update own" policy lets a client write.
-- Returns true when the profile was found, so the call has a body to read.
create or replace function public.record_app_version(p_version text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.profiles
       set ios_app_version = left(p_version, 32),
           ios_app_seen_at = now()
     where id = auth.uid()
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.record_app_version(text) from public, anon;
grant execute on function public.record_app_version(text) to authenticated;
