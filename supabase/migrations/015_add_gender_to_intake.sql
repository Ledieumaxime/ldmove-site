-- Add a "gender" field to the client intake form. Useful for programming
-- (biomechanical differences, relative-strength benchmarks).
-- Idempotent: safe to run against an existing database.

alter table public.client_intakes
  add column if not exists gender text;
