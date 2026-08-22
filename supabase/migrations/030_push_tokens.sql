-- Devices that can receive a push notification.
--
-- The in-app notification system (the `notifications` table) only reaches a
-- client who thinks to open the app. This is the other half: the phone
-- itself. Firebase hands the app a token per install, and that token is
-- what a push is addressed to.
--
-- One row per device, not per user: a client may have a phone and a tablet,
-- and both should ring. The token is the identity, hence the primary key.
--
-- Tokens rotate on their own (reinstall, app data cleared, Firebase
-- refresh), so the same user accumulates dead tokens over time. Firebase
-- reports those as unregistered when a send fails, and the sender deletes
-- them; `last_seen_at` is the fallback for pruning what never comes back.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A device registers itself for the person signed into it, and nobody else.
-- No select policy for clients on purpose: an app never needs to read the
-- list back, and the token of another device is nobody's business. The
-- sender runs on the service role and bypasses RLS.
drop policy if exists "push_tokens: register own device" on public.push_tokens;
create policy "push_tokens: register own device"
  on public.push_tokens for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_tokens: refresh own device" on public.push_tokens;
create policy "push_tokens: refresh own device"
  on public.push_tokens for update to authenticated
  using (user_id = auth.uid());

-- Signing out on a shared or borrowed phone must stop the notifications.
drop policy if exists "push_tokens: unregister own device" on public.push_tokens;
create policy "push_tokens: unregister own device"
  on public.push_tokens for delete to authenticated
  using (user_id = auth.uid() or public.is_coach());

comment on table public.push_tokens is
  'Firebase device tokens, one row per install. Fed by the app on launch, consumed by the send-push function.';
