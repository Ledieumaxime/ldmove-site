import { beforeEach, describe, expect, it } from "vitest";
import {
  CompletedLog,
  ProgramItemLite,
  ProgramWeekLite,
  clearDeferredWeeks,
  getDeferredWeeks,
  listProgramDays,
  nextDay,
  pendingDays,
  skipToWeek,
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

  it("skips a session without losing it", () => {
    const logs = [...run("w1", "r1")];
    // Legs is up next but the client skips it.
    expect(titleOf(nextDay(days, logs, ["w2"]))).toBe("Pull");
    // Nothing was logged, so Legs is still pending on the next visit.
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
  });

  it("still serves the session when it is the only one left to skip", () => {
    const logs = [
      ...run("w1", "r1"),
      ...run("w3", "r3"),
      ...run("w4", "r4"),
    ];
    // Legs is the last one pending: skipping it has nowhere to go.
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

describe("skipToWeek", () => {
  const programId = "p1";
  const pendingIds = ["w2", "w3", "w4"]; // Legs, Pull, Handstand

  beforeEach(() => sessionStorage.clear());

  it("steps over only what sits ahead of the chosen session", () => {
    expect(skipToWeek(programId, pendingIds, "w4")).toEqual(["w2", "w3"]);
    expect(getDeferredWeeks(programId)).toEqual(["w2", "w3"]);
  });

  it("lets the client come back to a session they skipped", () => {
    skipToWeek(programId, pendingIds, "w3"); // skip Legs, take Pull
    expect(getDeferredWeeks(programId)).toEqual(["w2"]);
    // Changing their mind back to Legs must clear the skip, not stack
    // onto it, otherwise Legs stays unreachable for the whole visit.
    expect(skipToWeek(programId, pendingIds, "w2")).toEqual([]);
    expect(getDeferredWeeks(programId)).toEqual([]);
  });

  it("is forgotten once a session is completed", () => {
    skipToWeek(programId, pendingIds, "w4");
    clearDeferredWeeks(programId);
    expect(getDeferredWeeks(programId)).toEqual([]);
  });
});

describe("pendingDays", () => {
  it("offers every session still owed this loop, in program order", () => {
    const logs = [...run("w1", "r1")];
    expect(pendingDays(days, logs).map((d) => d.weekTitle)).toEqual([
      "Legs",
      "Pull",
      "Handstand",
    ]);
  });

  it("never offers a session already done this loop", () => {
    // Push is done, so it must not be pickable again until the loop
    // restarts — otherwise the client could dodge a session for good.
    const logs = [...run("w1", "r1")];
    expect(pendingDays(days, logs).map((d) => d.weekId)).not.toContain("w1");
  });

  it("offers the whole block again once the loop restarts", () => {
    const logs = weeks.flatMap((w, i) => run(w.id, `r${i}`));
    expect(pendingDays(days, logs)).toHaveLength(4);
  });

  it("leaves out sessions the coach hasn't filled", () => {
    const withEmpty = listProgramDays(
      weeks,
      items.filter((i) => i.week_id !== "w2")
    );
    expect(pendingDays(withEmpty, []).map((d) => d.weekId)).not.toContain("w2");
  });
});
