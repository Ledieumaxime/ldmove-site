-- Intakes that were locked before the notification feature shipped got no
-- "intake_validated" notification. Backfill one for every locked intake that
-- doesn't already have one, so the client finally sees the banner on their
-- dashboard.

insert into public.notifications (user_id, type, title, body, link_url)
select
  ci.client_id,
  'intake_validated',
  'Your intake has been validated',
  'Maxime reviewed your intake and assessment videos. See his feedback in your profile.',
  '/app/intake'
from public.client_intakes ci
where ci.locked_at is not null
  and not exists (
    select 1
    from public.notifications n
    where n.user_id = ci.client_id
      and n.type = 'intake_validated'
  );
