-- Let a phone actually register itself.
--
-- Registration was refused with "new row violates row-level security
-- policy" even though the row's user_id matched the caller, which means
-- the insert policy 030 describes is not the one the database is
-- enforcing. Rather than guess at the difference, this restates all three
-- policies and the grants they depend on, so the file and the database
-- agree from here on.
--
-- The grants matter: a policy decides which rows a role may touch, but
-- the role still needs table privileges to touch any at all.

grant select, insert, update, delete on public.push_tokens to authenticated;

alter table public.push_tokens enable row level security;

-- A device registers itself for the person signed into it, and nobody
-- else. The app upserts on the token, so the same device relaunching
-- refreshes its row instead of failing on the primary key. That is an
-- INSERT ... ON CONFLICT DO UPDATE, which needs both an insert and an
-- update policy to pass.
drop policy if exists "push_tokens: register own device" on public.push_tokens;
create policy "push_tokens: register own device"
  on public.push_tokens for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_tokens: refresh own device" on public.push_tokens;
create policy "push_tokens: refresh own device"
  on public.push_tokens for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Signing out on a shared or borrowed phone must stop the notifications.
drop policy if exists "push_tokens: unregister own device" on public.push_tokens;
create policy "push_tokens: unregister own device"
  on public.push_tokens for delete to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- An upsert returns the row it wrote, so the caller needs to be able to
-- read its own back. Someone else's device token remains invisible.
drop policy if exists "push_tokens: read own device" on public.push_tokens;
create policy "push_tokens: read own device"
  on public.push_tokens for select to authenticated
  using (user_id = auth.uid() or public.is_coach());
