-- Let the coach dismiss a comment thread without replying.
--
-- The inbox treats a thread as "unanswered" when its most recent
-- message is from the client. Some client comments don't need an
-- answer ("ok thanks!"), and without a way to acknowledge them they
-- squat the inbox forever. dismissed_at on the latest client comment
-- marks the thread as handled; a newer client comment naturally
-- resurfaces the thread because it won't carry the flag.

alter table public.exercise_comments
  add column if not exists dismissed_at timestamptz;

-- Coach-only: nobody else needs to update comments (author edits are
-- not a feature; clients delete + repost instead).
drop policy if exists "exercise_comments: coach update" on public.exercise_comments;
create policy "exercise_comments: coach update"
  on public.exercise_comments for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
