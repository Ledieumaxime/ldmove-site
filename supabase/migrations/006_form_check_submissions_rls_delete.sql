-- Allow clients to delete their own form_check_submissions rows.
-- Without this, the client-side "delete video" button silently fails:
-- PostgREST returns 200 with 0 rows affected when RLS blocks a delete,
-- so the frontend thinks it worked but the row remains in the DB.
--
-- Idempotent (drops then recreates). Safe to run multiple times.

drop policy if exists "form_check_submissions: delete own"
  on public.form_check_submissions;

create policy "form_check_submissions: delete own"
  on public.form_check_submissions
  for delete
  to authenticated
  using (client_id = auth.uid());
