// Compute "the next workout day" for a client + program.
//
// A program is split into weeks. Within a week, items can be tagged with
// a `group_name` like "Day 1" / "Day 2" — when present, that grouping IS
// the unit of one workout session. When absent, the week itself is the
// unit (one program week = one workout).
//
// "Next day" = the first (week_number, day_label) tuple in sequence whose
// items have NO completed_at set in workout_logs. Once a day is completed
// we move on to the next one. If everything is done, we return null
// ("program finished").

export type ProgramItemLite = {
  id: string;
  week_id: string;
  order_index: number;
  group_name: string | null;
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
  /** group_name when items use it, otherwise null and the day = the whole week. */
  dayLabel: string | null;
  items: ProgramItemLite[];
};

/** All distinct days in the program, in training order. */
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

    // Split by group_name preserving the order they appear.
    const seenLabels = new Set<string | null>();
    const labelsInOrder: (string | null)[] = [];
    for (const it of weekItems) {
      const label = it.group_name ?? null;
      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        labelsInOrder.push(label);
      }
    }

    // If there's only a single null label, the week itself is the day.
    if (labelsInOrder.length === 1 && labelsInOrder[0] == null) {
      days.push({
        weekId: w.id,
        weekNumber: w.week_number,
        weekTitle: w.title,
        dayLabel: null,
        items: weekItems,
      });
      continue;
    }

    // Otherwise emit one WorkoutDay per group_name in encounter order.
    for (const label of labelsInOrder) {
      const dayItems = weekItems.filter((i) => (i.group_name ?? null) === label);
      if (dayItems.length === 0) continue;
      days.push({
        weekId: w.id,
        weekNumber: w.week_number,
        weekTitle: w.title,
        dayLabel: label,
        items: dayItems,
      });
    }
  }

  return days;
}

/** A day is "completed" if at least one of its items has a workout log
 *  with completed_at set. We don't require all items to be marked — the
 *  client clicks "Complete workout" once for the whole day and that
 *  stamps every logged set, so any non-null completed_at on a row of
 *  the day's items proves the day was finished. */
export function isDayCompleted(
  day: WorkoutDay,
  logs: CompletedLog[]
): boolean {
  const dayItemIds = new Set(day.items.map((i) => i.id));
  return logs.some(
    (l) => l.completed_at != null && dayItemIds.has(l.program_item_id)
  );
}

/** First day in sequence whose items have no completed_at, or null if
 *  the program is fully done. */
export function nextDay(
  days: WorkoutDay[],
  logs: CompletedLog[]
): WorkoutDay | null {
  for (const d of days) {
    if (!isDayCompleted(d, logs)) return d;
  }
  return null;
}

/** Human-readable label for a day, used in headers. */
export function dayDisplayLabel(day: WorkoutDay): string {
  const weekPart = day.weekTitle?.trim()
    ? day.weekTitle.trim()
    : `Week ${day.weekNumber}`;
  if (day.dayLabel) return `${weekPart} · ${day.dayLabel}`;
  return weekPart;
}
