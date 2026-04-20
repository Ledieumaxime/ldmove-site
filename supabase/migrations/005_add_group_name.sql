-- Add group_name column to program_items.
-- This column was added directly in the Supabase dashboard when superset
-- support was introduced, so it was missing from the git migration history.
-- This file captures the existing schema so the database can be rebuilt
-- from migrations without breaking the import scripts.
-- Run this in Supabase SQL Editor; idempotent thanks to IF NOT EXISTS.

alter table public.program_items
  add column if not exists group_name text;

-- Optional helpful index if we ever query items by group within a week
create index if not exists idx_program_items_week_group
  on public.program_items (week_id, group_name);
