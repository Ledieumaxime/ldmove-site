-- Archiving a client, as opposed to deleting them.
--
-- "Delete client" wipes everything: programs, comments, logs, storage,
-- the auth user. That is the right move for an account created and
-- never used, and the wrong move for someone the coach actually worked
-- with and who stopped. Archiving keeps the whole history and only
-- takes the client out of the coach's day-to-day lists.
--
-- What an archived client keeps (decided with the coach 2026-08-14):
--   programs + exercises + coach notes, comments, logged sets,
--   assessment videos, form-check videos flagged as progress.
-- What goes: ordinary form-check videos, cleaned up the same way a
-- block archive does (cleanup-archived-videos already spares the
-- progress ones since the 2026-08-14 fix).
--
-- The client keeps their account and their read access: they can still
-- open their archive and their past blocks. Their active block is
-- archived at the same time so they don't stare at a program that is
-- no longer running.

alter table public.profiles
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text;

comment on column public.profiles.archived_at is
  'Set when the coach archives the client. Null = active client.';
comment on column public.profiles.archive_reason is
  'Why they are archived: stopped / paused / never_started. Free text, no constraint, so the vocabulary can grow.';

-- Partial index: the coach dashboard filters archived clients out of
-- every list, so the common query is "role = client and not archived".
create index if not exists idx_profiles_active_clients
  on public.profiles (role)
  where archived_at is null;

-- No new RLS needed: "profiles: coach can update anyone" already
-- covers writing these columns, and "profiles: select own or coach"
-- covers reading them. A client can technically read their own
-- archived_at, which is fine — nothing secret in it.
