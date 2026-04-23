-- Lock the onboarding snapshot once the coach has reviewed intake + assessment.
-- After lock, neither the client nor the coach edits intake answers or
-- assessment videos through the app — they're a fact of the client's level
-- at T0 and must stay archived.

-- 1. Track the lock on the intake (single source of truth for the whole onboarding).
alter table public.client_intakes
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id);

-- Helper: is this client's onboarding locked?
create or replace function public.is_onboarding_locked(p_client_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.client_intakes
    where client_id = p_client_id and locked_at is not null
  );
$$;

-- 2. Client update policy — block once locked.
drop policy if exists "client_intakes: update own" on public.client_intakes;
create policy "client_intakes: update own"
  on public.client_intakes for update to authenticated
  using (client_id = auth.uid() and locked_at is null)
  with check (client_id = auth.uid() and locked_at is null);

-- 3. Allow the coach to update an intake (needed to set/clear locked_at).
drop policy if exists "client_intakes: update coach" on public.client_intakes;
create policy "client_intakes: update coach"
  on public.client_intakes for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());

-- 4. Block assessment video mutations for the client once locked.
drop policy if exists "av_insert_own" on public.assessment_videos;
create policy "av_insert_own"
  on public.assessment_videos for insert to authenticated
  with check (
    client_id = auth.uid()
    and not public.is_onboarding_locked(client_id)
  );

drop policy if exists "av_update_own" on public.assessment_videos;
create policy "av_update_own"
  on public.assessment_videos for update to authenticated
  using (
    client_id = auth.uid()
    and not public.is_onboarding_locked(client_id)
  )
  with check (
    client_id = auth.uid()
    and not public.is_onboarding_locked(client_id)
  );

drop policy if exists "av_delete_own_or_coach" on public.assessment_videos;
create policy "av_delete_own_or_coach"
  on public.assessment_videos for delete to authenticated
  using (
    (client_id = auth.uid() and not public.is_onboarding_locked(client_id))
    or public.is_coach()
  );

-- 5. Block storage bucket mutations for the client once locked.
drop policy if exists "av_bucket_insert" on storage.objects;
create policy "av_bucket_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_onboarding_locked(auth.uid())
  );

drop policy if exists "av_bucket_delete" on storage.objects;
create policy "av_bucket_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assessment-videos'
    and (
      ((storage.foldername(name))[1] = auth.uid()::text
        and not public.is_onboarding_locked(auth.uid()))
      or public.is_coach()
    )
  );
