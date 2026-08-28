-- Let a comment carry one image, so the coach can correct a position by
-- pointing at it instead of describing it. The picture is annotated in
-- the phone's own photo editor before it is attached: building a drawing
-- tool inside the app would cost many times this, for something every
-- phone already does well.
--
-- Idempotent, like the other policy migrations here: safe to re-run.

alter table public.exercise_comments
  add column if not exists image_url text;

-- ============ STORAGE BUCKET comment-images ============
-- Private bucket, read through signed URLs.
--
-- HEIC is deliberately absent from the allowed types. iOS converts a
-- library photo to JPEG on its way into a file input, so allowing HEIC
-- would only let through the rare file that no browser can then display
-- — a broken image instead of a clear "unsupported file" at upload time.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-images',
  'comment-images',
  false,
  10485760, -- 10 MB: a phone screenshot is well under 1 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Files are filed under the CLIENT the thread belongs to, never under
-- whoever uploaded them: {client_id}/{filename}. That one decision is
-- what lets a client read the picture their coach just sent while
-- keeping every other client out, with the same folder rule the
-- form-checks bucket already uses.

drop policy if exists "comment-images: read own or coach" on storage.objects;
create policy "comment-images: read own or coach"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comment-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach())
  );

drop policy if exists "comment-images: insert own or coach" on storage.objects;
create policy "comment-images: insert own or coach"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comment-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach())
  );

drop policy if exists "comment-images: delete own or coach" on storage.objects;
create policy "comment-images: delete own or coach"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comment-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach())
  );
