-- Full RLS policy set for form_check_submissions table + form-checks storage bucket.
-- Idempotent: drops and recreates every policy so state is deterministic.
-- Run this in Supabase SQL Editor if the client-side upload or delete starts
-- failing with "new row violates row-level security policy" or silent no-ops.

-- ============ TABLE form_check_submissions ============

alter table public.form_check_submissions enable row level security;

drop policy if exists "form_check_submissions: select own or coach" on public.form_check_submissions;
create policy "form_check_submissions: select own or coach"
  on public.form_check_submissions for select to authenticated
  using (client_id = auth.uid() or public.is_coach());

drop policy if exists "form_check_submissions: insert own" on public.form_check_submissions;
create policy "form_check_submissions: insert own"
  on public.form_check_submissions for insert to authenticated
  with check (client_id = auth.uid());

drop policy if exists "form_check_submissions: update coach" on public.form_check_submissions;
create policy "form_check_submissions: update coach"
  on public.form_check_submissions for update to authenticated
  using (public.is_coach()) with check (public.is_coach());

drop policy if exists "form_check_submissions: delete own" on public.form_check_submissions;
create policy "form_check_submissions: delete own"
  on public.form_check_submissions for delete to authenticated
  using (client_id = auth.uid());

-- ============ STORAGE BUCKET form-checks ============
-- Files are organized by client_id: {client_id}/{filename}

drop policy if exists "form-checks: client read own" on storage.objects;
create policy "form-checks: client read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'form-checks'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach())
  );

drop policy if exists "form-checks: client insert own" on storage.objects;
create policy "form-checks: client insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'form-checks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "form-checks: client delete own" on storage.objects;
create policy "form-checks: client delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'form-checks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
