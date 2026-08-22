-- Notify a client that their work was reviewed, not that a comment exists.
--
-- Answering twenty form checks in one sitting sent twenty pushes. A client
-- does not need to know each time a sentence is written; they need to know
-- their coach looked at their training, which is one event per review
-- session however many comments it contains. The comments themselves are
-- untouched and all appear in the inbox with their unread badge.
--
-- Records when we last told this person about a comment. `send-push` reads
-- it, stays quiet inside the window, and updates it when it does send.
-- Kept on the profile rather than on push_tokens because the limit belongs
-- to the person, not to each handset they happen to own.
--
-- Comments only. A published program, an archived milestone or a validated
-- intake are rare and distinct, and always go through.

alter table public.profiles
  add column if not exists last_comment_push_at timestamptz;

comment on column public.profiles.last_comment_push_at is
  'Last time a comment notification was pushed to this user. Throttles a burst of coach replies down to one notification per review session.';
