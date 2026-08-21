-- Fixes the backfill done in 028.
--
-- 028 flagged a client as French if ANY of their coach comments held a
-- French word. One match was enough, so a typo decided the language of
-- a whole roster: Cym got 'fr' from "but tu feel where is your balance"
-- (a mistyped "to") and Aman from an equally isolated slip, against 39
-- and 61 genuinely English comments.
--
-- Counting per comment and requiring a strict majority makes a single
-- typo harmless: it has to out-vote every other comment to matter.

with tallies as (
  select
    pr.assigned_client_id as client_id,
    count(*) filter (
      where c.body ~* '\m(tu|ton|ta|tes|pour|avec|dans|garde|comme|peux|dois|les|des|une|est|sur|plus|bien)\M'
    ) as fr_hits,
    count(*) filter (
      where c.body ~* '\m(the|your|you|and|with|for|this|that|keep|make|when|should|more|from|will|can)\M'
    ) as en_hits
  from public.exercise_comments c
  join public.program_items pi on pi.id = c.item_id
  join public.program_weeks pw on pw.id = pi.week_id
  join public.programs pr on pr.id = pw.program_id
  where c.author_role = 'coach'
    and pr.assigned_client_id is not null
  group by pr.assigned_client_id
)
update public.profiles p
set language = case when t.fr_hits > t.en_hits then 'fr' else 'en' end
from tallies t
where p.id = t.client_id
  and p.role = 'client'
  and p.language is distinct from
      (case when t.fr_hits > t.en_hits then 'fr' else 'en' end);
