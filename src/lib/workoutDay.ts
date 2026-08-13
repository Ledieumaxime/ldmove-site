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
  /** True when the session has no exercises yet. Surfaced to the
   *  client UI so they see "This session is empty" instead of being
   *  silently shifted to the next non-empty session (which broke the
   *  modulo math and made the loop wrap a session early). */
  isEmpty: boolean;
};

/** All training sessions in the program, in week_number order.
 *  Empty sessions are kept in the list so the modulo in `nextDay`
 *  matches what ProgramDetail shows (every program_weeks row counts),
 *  but flagged via `isEmpty` so consumers can render them differently. */
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
    days.push({
      weekId: w.id,
      weekNumber: w.week_number,
      weekTitle: w.title,
      items: weekItems,
      isEmpty: weekItems.length === 0,
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

/** How many times each session has been completed, keyed by weekId.
 *  Runs are counted per session, not globally, which is what lets the
 *  loop survive a client doing the sessions out of order. */
export function completionsByDay(
  days: WorkoutDay[],
  logs: CompletedLog[]
): Map<string, number> {
  const dayOfItem = new Map<string, string>(); // item id → week id
  for (const d of days) for (const i of d.items) dayOfItem.set(i.id, d.weekId);
  const runsSeen = new Set<string>();
  const counts = new Map<string, number>(days.map((d) => [d.weekId, 0]));
  for (const log of logs) {
    if (!log.completed_at) continue;
    const weekId = dayOfItem.get(log.program_item_id);
    if (!weekId) continue;
    if (runsSeen.has(log.session_run_id)) continue;
    runsSeen.add(log.session_run_id);
    counts.set(weekId, (counts.get(weekId) ?? 0) + 1);
  }
  return counts;
}

/** The session the client should see next.
 *
 *  Rule: the first session of the block they have not done yet in the
 *  current loop. Concretely, with L = the fewest completions any
 *  session has, serve the first session sitting at L.
 *
 *  This replaces the old `days[T mod N]`, which only knew HOW MANY
 *  sessions were done, not WHICH. That mattered the moment a client
 *  wanted to swap two sessions around (tired legs, gym closed): doing
 *  Push instead of Legs bumped the counter, so the next day served
 *  Push again and Legs never came back. Counting per session means a
 *  skipped session is simply still pending and comes back on its own,
 *  so the order can flex without the client escaping any session.
 *
 *  Empty sessions (the coach hasn't filled them yet) can never be
 *  completed, so they're excluded from the rotation — otherwise the
 *  client would be parked on one forever. If every session is empty we
 *  fall back to the first one, which renders the "not filled yet"
 *  screen. */
export function nextDay<T extends ProgramItemLite>(
  days: WorkoutDay<T>[],
  logs: CompletedLog[],
  /** Sessions to step over this once, e.g. the one just deferred. */
  skipWeekIds: string[] = []
): WorkoutDay<T> | null {
  if (days.length === 0) return null;
  const playable = days.filter((d) => !d.isEmpty);
  if (playable.length === 0) return days[0] ?? null;

  const counts = completionsByDay(days, logs);
  const loop = Math.min(...playable.map((d) => counts.get(d.weekId) ?? 0));
  const pending = playable.filter((d) => (counts.get(d.weekId) ?? 0) === loop);

  const skip = new Set(skipWeekIds);
  // Deferring only makes sense while something else is pending.
  const candidates = pending.filter((d) => !skip.has(d.weekId));
  return (candidates[0] ?? pending[0]) ?? null;
}

/** Human-readable label for a session, used in headers. */
export function dayDisplayLabel(day: WorkoutDay): string {
  return day.weekTitle?.trim() ? day.weekTitle.trim() : `Session ${day.weekNumber}`;
}
