-- Allow a form-check submission to be archived as a progress milestone.
-- When the coach sees a video worth keeping as a reference, they flip the
-- archived_as_progress flag and optionally leave a short description
-- (e.g. "Handstand, month 3 — first 5s freestanding hold"). The client's
-- archive page lists every archived submission alongside their initial
-- assessment videos.

alter table public.form_check_submissions
  add column if not exists archived_as_progress boolean not null default false,
  add column if not exists archived_note text,
  add column if not exists archived_at timestamptz;

create index if not exists idx_form_check_submissions_archived
  on public.form_check_submissions (client_id, archived_at desc)
  where archived_as_progress;
