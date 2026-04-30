-- Mark a workout (a day's session) as finished. The client clicks "Complete
-- workout" once they're done with the day's exercises; we stamp completed_at
-- on every log row of today's session for the items they did. The next time
-- they hit /app/today, the helper finds the next uncompleted day in
-- sequence and renders that.
--
-- Stays nullable: a session in progress (some sets logged but not finished)
-- has completed_at null on every row.

alter table public.workout_logs
  add column if not exists completed_at timestamptz;

-- Quick lookup of "what day did this client last finish?"
create index if not exists idx_workout_logs_client_completed
  on public.workout_logs (client_id, completed_at)
  where completed_at is not null;
