-- Capture the exercise_comments table (and its RLS) in the migration history.
-- This table was originally added via the Supabase dashboard, so it was missing
-- from git. Idempotent: safe to run against an environment that already has it.

create table if not exists public.exercise_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.program_items(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_role text not null check (author_role in ('coach', 'client')),
  body text not null,
  parent_id uuid references public.exercise_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_exercise_comments_item
  on public.exercise_comments (item_id, created_at);

alter table public.exercise_comments enable row level security;

-- Everyone who can see the parent item can read the comment thread.
drop policy if exists "exercise_comments: read via item" on public.exercise_comments;
create policy "exercise_comments: read via item"
  on public.exercise_comments for select to authenticated
  using (
    exists (
      select 1
      from public.program_items pi
      join public.program_weeks pw on pw.id = pi.week_id
      join public.programs p on p.id = pw.program_id
      where pi.id = exercise_comments.item_id
        and (
          public.is_coach()
          or (p.type = 'catalogue' and p.is_published = true)
          or (p.type = 'custom' and p.assigned_client_id = auth.uid())
        )
    )
  );

-- Users can only post as themselves.
drop policy if exists "exercise_comments: insert own" on public.exercise_comments;
create policy "exercise_comments: insert own"
  on public.exercise_comments for insert to authenticated
  with check (author_id = auth.uid());

-- Authors delete their own comments; the coach can delete anything.
drop policy if exists "exercise_comments: delete own or coach" on public.exercise_comments;
create policy "exercise_comments: delete own or coach"
  on public.exercise_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_coach());
