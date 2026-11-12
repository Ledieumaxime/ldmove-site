-- When the client went through the app tour (the seven slides that open
-- on the dashboard). It opens once, the first time a client lands on the
-- dashboard with an active block, and never again on its own: kept on the
-- profile rather than on the phone, so a new phone or a reinstall does
-- not bring it back. Null = not seen yet, which is every client who had
-- the app before the tour existed (decided with Maxime on 2026-11-12:
-- they see it once at their next visit).

alter table public.profiles
  add column if not exists tour_seen_at timestamptz;

-- The client marks it for themselves only. SECURITY DEFINER for the same
-- reason as record_app_version: it does not depend on which profile
-- columns the "update own" policy lets a client write.
-- Returns true when the profile was found, so the call has a body to read.
create or replace function public.mark_tour_seen()
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.profiles
       set tour_seen_at = now()
     where id = auth.uid()
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.mark_tour_seen() from public, anon;
grant execute on function public.mark_tour_seen() to authenticated;
