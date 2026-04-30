// Compute "the next workout session" for a client + program.
//
// In LD Move's data model, ONE week = ONE workout session. The week's
// title is the session label ("SESSION 1 — PUSH" etc.). The `group_name`
// field on program_items is reserved for SUPERSETS (chains of exercises
// done back-to-back), not for splitting a week into multiple days.
//
// "Next session" = the first week in week_number order whose items have
// NO completed_at set in workout_logs. Once a session is completed we
// move on. If everything is done, we return null ("program finished").

export type ProgramItemLite = {
  id: string;
  week_id: string;
  order_index: number;
};

export type ProgramWeekLite = {
  id: string;
  week_number: number;
  title: string | null;
};

export type CompletedLog = {
  program_item_id: string;
  session_run_id: string;
  session_date: string;
  completed_at: string | null;
};

export type WorkoutDay<T extends ProgramItemLite = ProgramItemLite> = {
  weekId: string;
  weekNumber: number;
  weekTitle: string | null;
  items: T[];
};

/** All training sessions in the program, in week_number order. */
export function listProgramDays<T extends ProgramItemLite>(
  weeks: ProgramWeekLite[],
  items: T[]
): WorkoutDay<T>[] {
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const days: WorkoutDay<T>[] = [];

  for (const w of sortedWeeks) {
    const weekItems = items
      .filter((i) => i.week_id === w.id)
      .sort((a, b) => a.order_index - b.order_index);
    if (weekItems.length === 0) continue;
    days.push({
      weekId: w.id,
      weekNumber: w.week_number,
      weekTitle: w.title,
      items: weekItems,
    });
  }

  return days;
}

/** A session is "completed" if at least one of its items has a workout
 *  log with completed_at set. The client clicks "Complete workout" once
 *  per session and that stamps every logged set in one go, so any
 *  non-null completed_at on a row of the session's items proves it was
 *  finished. */
export function isDayCompleted(
  day: WorkoutDay,
  logs: CompletedLog[]
): boolean {
  const dayItemIds = new Set(day.items.map((i) => i.id));
  return logs.some(
    (l) => l.completed_at != null && dayItemIds.has(l.program_item_id)
  );
}

/** Count distinct completed sessions for this set of days. A session
 *  is identified by its session_run_id (one UUID per actual run), so
 *  two same-day runs of the same week count as two completions. */
export function countCompletedSessions(
  days: WorkoutDay[],
  logs: CompletedLog[]
): number {
  const validItemIds = new Set(days.flatMap((d) => d.items.map((i) => i.id)));
  const seen = new Set<string>();
  for (const log of logs) {
    if (!log.completed_at) continue;
    if (!validItemIds.has(log.program_item_id)) continue;
    seen.add(log.session_run_id);
  }
  return seen.size;
}

/** The session the client should see next. Pure counting, no date logic:
 *  given T total completions, return days[T mod N]. After session N
 *  the loop wraps back to session 1, but the *display* number keeps
 *  climbing (Session 16 = loop 6 day 1) so the client sees their
 *  cumulative count. */
export function nextDay<T extends ProgramItemLite>(
  days: WorkoutDay<T>[],
  logs: CompletedLog[]
): WorkoutDay<T> | null {
  if (days.length === 0) return null;
  const completed = countCompletedSessions(days, logs);
  return days[completed % days.length] ?? null;
}

/** Human-readable label for a session, used in headers. */
export function dayDisplayLabel(day: WorkoutDay): string {
  return day.weekTitle?.trim() ? day.weekTitle.trim() : `Session ${day.weekNumber}`;
}
