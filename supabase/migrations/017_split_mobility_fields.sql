-- Replace the old generic "splits" checkbox with three separate single-choice
-- fields so front-split left / right asymmetries and the middle split can be
-- tracked independently and validated against the matching video exercises.

alter table public.client_intakes
  add column if not exists front_split_left text,
  add column if not exists front_split_right text,
  add column if not exists middle_split text;
