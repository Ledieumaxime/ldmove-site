-- Remove the placeholder catalogue programs seeded in 003_seed_programs.sql.
-- They had no real exercises, were never surfaced on the public site (the
-- /programmes page links straight to Coming Soon variants), and their stale
-- "49€ / 39€" entries in the database were only creating confusion.
-- Idempotent: safe to run multiple times.

delete from public.programs
  where slug in ('middle-split', 'handstand-debutant');
