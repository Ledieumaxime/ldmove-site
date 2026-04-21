-- Capture the comment_reads table (and its RLS) in the migration history.
-- Tracks the last time a user "read" the comment thread on a given item so
-- the UI can show unread badges. Composite primary key on (user_id, item_id).

create table if not exists public.comment_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.program_items(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.comment_reads enable row level security;

-- A user can only read and write their own read-markers.
drop policy if exists "comment_reads: select own" on public.comment_reads;
create policy "comment_reads: select own"
  on public.comment_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "comment_reads: upsert own" on public.comment_reads;
create policy "comment_reads: upsert own"
  on public.comment_reads for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "comment_reads: update own" on public.comment_reads;
create policy "comment_reads: update own"
  on public.comment_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
