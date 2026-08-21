-- The language the coach writes to a client in.
--
-- Maxime coaches in English but thinks in French, which shows: his
-- comments carry French-speaker slips ("Exemple", "let's said", "witch
-- control", "pressure un your knuckle"). The plan is to let him write
-- in whichever language comes out and have an assistant rewrite it
-- cleanly for the client. For that the app has to know which language
-- the client actually reads.
--
-- Measured on the 154 coach comments before this migration, the split
-- is absolute: Aman 61 EN / 0 FR, Cym 39 / 0, Niki 18 / 0, Mayur 4 / 0,
-- Fanny 0 EN / 30 FR. Never mixed within a client. So this belongs to
-- the person, not to a per-message toggle.
--
-- Lives on `profiles` rather than `client_intakes`: it governs how the
-- app addresses someone everywhere (comments today, notification and
-- email copy later), and it has to survive a client who never filled
-- an intake.

alter table public.profiles
  add column if not exists language text not null default 'en'
    check (language in ('en', 'fr'));

comment on column public.profiles.language is
  'Language the client reads: en | fr. Set by the client during intake, editable by the coach.';

-- Backfill the existing roster from what the coach already writes to
-- them, so nobody has to retype what the data already says.
update public.profiles p
set language = 'fr'
where p.role = 'client'
  and exists (
    select 1
    from public.exercise_comments c
    join public.program_items pi on pi.id = c.item_id
    join public.program_weeks pw on pw.id = pi.week_id
    join public.programs pr on pr.id = pw.program_id
    where pr.assigned_client_id = p.id
      and c.author_role = 'coach'
      -- French function words that have no English homograph, so a
      -- single hit is already decisive.
      and c.body ~* '\m(tu|ton|ta|tes|pour|avec|dans|garde|comme|peux|dois)\M'
  );
