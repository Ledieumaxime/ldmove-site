-- The client needs to see the coach's per-skill review (badge + notes) on
-- their own intake page. Until now the SELECT policy only allowed the coach.
-- Repurpose the legacy `status` column to mean 'validated' | 'needs_work' so
-- the coach can leave a note on any skill (not just the ones to work on) and
-- the client UI can render the right badge.

-- 1. Let the client read their own rows.
drop policy if exists "cla_select_coach" on public.client_level_assessments;
create policy "cla_select_own_or_coach"
  on public.client_level_assessments for select to authenticated
  using (client_id = auth.uid() or public.is_coach());

-- 2. Reshape the status check constraint to the two states we actually use.
alter table public.client_level_assessments
  drop constraint if exists client_level_assessments_status_check;

-- Normalise existing rows to the new vocabulary:
-- - rows with notes or actual_value => needs_work (that's how the UI used to
--   mark them)
-- - other rows => validated
update public.client_level_assessments
  set status = case
    when actual_value is not null or (notes is not null and notes <> '')
      then 'needs_work'
    else 'validated'
  end
  where status is null
     or status not in ('validated', 'needs_work');

alter table public.client_level_assessments
  add constraint client_level_assessments_status_check
  check (status in ('validated', 'needs_work'));
