-- Remember that a client has already been told about their program.
--
-- Publishing sends a real email on top of the in-app notification and the
-- push. A coach who un-publishes to fix a typo and publishes again should
-- not put a second "your new program is ready" in a client's inbox, so
-- the send has to know whether it already happened.
--
-- Null means never announced. Set by `notify-program-published` once the
-- email is actually away, never on a failed send.

alter table public.programs
  add column if not exists client_notified_at timestamptz;

comment on column public.programs.client_notified_at is
  'When the assigned client was told this program is ready. Null means never. Makes publishing announce itself exactly once, however many times it is toggled.';
