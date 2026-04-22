-- Assessment videos — native storage for the client's initial video
-- assessment. Replaces the Drive-based workflow used until now. Each row
-- is one slot (client × exercise_number) with a single current video
-- uploaded to the assessment-videos storage bucket.

-- 1. Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-videos',
  'assessment-videos',
  false,
  209715200, -- 200 MB per video
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
)
on conflict (id) do nothing;

-- 2. Table (one video per exercise per client; replacement overwrites)
create table if not exists public.assessment_videos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  exercise_number int not null,
  exercise_name text not null,
  video_path text not null,
  uploaded_at timestamptz not null default now(),
  unique (client_id, exercise_number)
);

create index if not exists idx_assessment_videos_client
  on public.assessment_videos (client_id, exercise_number);

alter table public.assessment_videos enable row level security;

drop policy if exists "av_select_own_or_coach" on public.assessment_videos;
create policy "av_select_own_or_coach"
  on public.assessment_videos for select to authenticated
  using (client_id = auth.uid() or public.is_coach());

drop policy if exists "av_insert_own" on public.assessment_videos;
create policy "av_insert_own"
  on public.assessment_videos for insert to authenticated
  with check (client_id = auth.uid());

drop policy if exists "av_update_own" on public.assessment_videos;
create policy "av_update_own"
  on public.assessment_videos for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "av_delete_own_or_coach" on public.assessment_videos;
create policy "av_delete_own_or_coach"
  on public.assessment_videos for delete to authenticated
  using (client_id = auth.uid() or public.is_coach());

-- 3. Storage bucket policies
drop policy if exists "av_bucket_select" on storage.objects;
create policy "av_bucket_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assessment-videos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach())
  );

drop policy if exists "av_bucket_insert" on storage.objects;
create policy "av_bucket_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "av_bucket_delete" on storage.objects;
create policy "av_bucket_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assessment-videos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach())
  );
