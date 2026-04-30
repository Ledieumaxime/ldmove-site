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
  completed_at: string | null;
};

export type WorkoutDay = {
  weekId: string;
  weekNumber: number;
  weekTitle: string | null;
  items: ProgramItemLite[];
};

/** All training sessions in the program, in week_number order. */
export function listProgramDays(
  weeks: ProgramWeekLite[],
  items: ProgramItemLite[]
): WorkoutDay[] {
  const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const days: WorkoutDay[] = [];

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

/** Pick which session the client should see today.
 *
 *  The block (a program of N sessions) is meant to loop: once the client
 *  finishes session N, they restart at session 1 until the coach
 *  assigns a new block. So this function is *not* a "first uncompleted"
 *  check — it cycles.
 *
 *  Logic:
 *  - No completion ever → session 1
 *  - Most recent completion happened today → stay on it (so the client
 *    sees the celebratory banner for their just-finished session)
 *  - Most recent completion was before today → advance to the next
 *    session in week order, wrapping back to 1 after the last one
 */
export function nextDay(
  days: WorkoutDay[],
  logs: CompletedLog[],
  todayISODate: string
): WorkoutDay | null {
  if (days.length === 0) return null;

  // Find the most recently completed session.
  let lastCompleted: WorkoutDay | null = null;
  let lastCompletedAt: string | null = null;
  for (const log of logs) {
    if (!log.completed_at) continue;
    if (lastCompletedAt && log.completed_at <= lastCompletedAt) continue;
    const day = days.find((d) =>
      d.items.some((i) => i.id === log.program_item_id)
    );
    if (!day) continue;
    lastCompleted = day;
    lastCompletedAt = log.completed_at;
  }

  if (!lastCompleted || !lastCompletedAt) return days[0];

  // If the last completion was TODAY, the client is still on that session
  // (they just finished it, show them the celebration).
  if (lastCompletedAt.startsWith(todayISODate)) return lastCompleted;

  // Otherwise advance, wrapping back to the first session after the last.
  const lastIdx = days.findIndex((d) => d.weekId === lastCompleted!.weekId);
  if (lastIdx === -1) return days[0];
  const nextIdx = (lastIdx + 1) % days.length;
  return days[nextIdx];
}

/** Human-readable label for a session, used in headers. */
export function dayDisplayLabel(day: WorkoutDay): string {
  return day.weekTitle?.trim() ? day.weekTitle.trim() : `Session ${day.weekNumber}`;
}
