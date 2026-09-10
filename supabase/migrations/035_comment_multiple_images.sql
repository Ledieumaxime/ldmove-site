-- Let one comment carry several pictures.
--
-- Correcting a position often needs two frames, not one: two angles of
-- the same rep, or a before and after. One image per comment forced the
-- coach to split that into two messages, which reads as two separate
-- corrections in the thread.
--
-- `image_url` (single path) stays on the table, backfilled into the new
-- array and then unused by the app. Dropping it would make a rollback
-- to the previous build lose every existing picture, and the column
-- costs nothing where it is.
--
-- Idempotent: safe to re-run.

alter table public.exercise_comments
  add column if not exists image_urls text[] not null default '{}';

-- Existing single images become one-element arrays, so the read path
-- only ever has to look at one column.
update public.exercise_comments
set image_urls = array[image_url]
where image_url is not null
  and coalesce(array_length(image_urls, 1), 0) = 0;
