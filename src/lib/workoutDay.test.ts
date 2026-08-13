import { describe, expect, it } from "vitest";
import {
  CompletedLog,
  ProgramItemLite,
  ProgramWeekLite,
  listProgramDays,
  nextDay,
} from "./workoutDay";

// A block of four sessions, two exercises each, mirroring how the app
// builds them: one program_weeks row per session.
const weeks: ProgramWeekLite[] = [
  { id: "w1", week_number: 1, title: "Push" },
  { id: "w2", week_number: 2, title: "Legs" },
  { id: "w3", week_number: 3, title: "Pull" },
  { id: "w4", week_number: 4, title: "Handstand" },
];
const items: ProgramItemLite[] = weeks.flatMap((w, i) => [
  { id: `${w.id}-a`, week_id: w.id, order_index: i * 2 },
  { id: `${w.id}-b`, week_id: w.id, order_index: i * 2 + 1 },
]);
const days = listProgramDays(weeks, items);

/** One completed run of a session: the client logs sets on its items
 *  and "Complete workout" stamps completed_at on all of them. */
const run = (weekId: string, runId: string, date = "2026-08-14"): CompletedLog[] => [
  {
    program_item_id: `${weekId}-a`,
    session_run_id: runId,
    session_date: date,
    completed_at: `${date}T10:00:00Z`,
  },
  {
    program_item_id: `${weekId}-b`,
    session_run_id: runId,
    session_date: date,
    completed_at: `${date}T10:00:00Z`,
  },
];

const titleOf = (d: ReturnType<typeof nextDay>) => d?.weekTitle ?? null;

describe("nextDay", () => {
  it("starts a fresh block on the first session", () => {
    expect(titleOf(nextDay(days, []))).toBe("Push");
  });

  it("walks the block in order when nothing is skipped", () => {
    const logs = [...run("w1", "r1")];
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
    logs.push(...run("w2", "r2"));
    expect(titleOf(nextDay(days, logs))).toBe("Pull");
  });

  it("brings back the skipped session when one is done out of order", () => {
    // Cym's case: legs are sore after tennis, so he does Pull instead
    // of Legs. Legs must be what comes next, not Pull again.
    const logs = [...run("w1", "r1"), ...run("w3", "r3")];
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
  });

  it("only loops once every session of the block is done", () => {
    const logs = [
      ...run("w1", "r1"),
      ...run("w3", "r3"),
      ...run("w4", "r4"),
    ];
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
    logs.push(...run("w2", "r2"));
    // Loop 2 opens on the first session again.
    expect(titleOf(nextDay(days, logs))).toBe("Push");
  });

  it("counts two runs of the same session on the same day as two", () => {
    // Morning + evening session: session_run_id differs, session_date
    // doesn't. Push is then ahead of the others and must not be served.
    const logs = [
      ...run("w1", "r1", "2026-08-14"),
      ...run("w1", "r1b", "2026-08-14"),
    ];
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
  });

  it("defers a session without losing it", () => {
    const logs = [...run("w1", "r1")];
    // Legs is up next but the client defers it.
    expect(titleOf(nextDay(days, logs, ["w2"]))).toBe("Pull");
    // Nothing was logged, so Legs is still pending on the next visit.
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
  });

  it("still serves the session when it is the only one left to defer", () => {
    const logs = [
      ...run("w1", "r1"),
      ...run("w3", "r3"),
      ...run("w4", "r4"),
    ];
    // Legs is the last one pending: deferring it has nowhere to go.
    expect(titleOf(nextDay(days, logs, ["w2"]))).toBe("Legs");
  });

  it("never parks the client on a session the coach left empty", () => {
    const withEmpty = listProgramDays(weeks, items.filter((i) => i.week_id !== "w2"));
    expect(withEmpty.find((d) => d.weekId === "w2")?.isEmpty).toBe(true);
    // Legs has no exercises, so it can never be completed: the
    // rotation has to step over it instead of stalling.
    const logs = [...run("w1", "r1")];
    expect(titleOf(nextDay(withEmpty, logs))).toBe("Pull");
  });

  it("returns null on a block with no session at all", () => {
    expect(nextDay([], [])).toBeNull();
  });
});
