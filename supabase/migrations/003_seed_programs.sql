-- Seed initial catalogue programs
-- Run this in Supabase SQL Editor

insert into public.programs (slug, title, description, type, price_eur, billing_type, duration_weeks, is_published)
values
  (
    'middle-split',
    'Middle Split',
    'Programme progressif de 8 semaines pour atteindre le grand écart latéral (middle split). Mobilité des hanches, souplesse active et passive, renforcement des adducteurs.',
    'catalogue',
    49,
    'one_time',
    8,
    true
  ),
  (
    'handstand-debutant',
    'Handstand Débutant',
    'Apprends à tenir le handstand (équilibre sur les mains) en 12 semaines. Renforcement, alignement, équilibre au mur puis libre.',
    'catalogue',
    39,
    'one_time',
    12,
    true
  )
on conflict (slug) do nothing;

-- Add a few sample weeks for Middle Split
insert into public.program_weeks (program_id, week_number, title, notes)
select p.id, w.num, w.title, w.notes
from public.programs p
cross join (values
  (1, 'Fondations mobilité', 'On ouvre doucement les hanches et on apprend les positions clés.'),
  (2, 'Activation musculaire', 'On renforce les adducteurs et le gainage pour un split sûr.'),
  (3, 'Amplitude progressive', 'On descend plus bas, avec contrôle.')
) as w(num, title, notes)
where p.slug = 'middle-split'
on conflict (program_id, week_number) do nothing;

-- Add sample weeks for Handstand
insert into public.program_weeks (program_id, week_number, title, notes)
select p.id, w.num, w.title, w.notes
from public.programs p
cross join (values
  (1, 'Poignets et épaules', 'Préparation articulaire + posture d''alignement.'),
  (2, 'Hollow body et planche', 'Gainage spécifique pour le handstand.'),
  (3, 'Handstand au mur', 'Première tenue avec appui mural.')
) as w(num, title, notes)
where p.slug = 'handstand-debutant'
on conflict (program_id, week_number) do nothing;
