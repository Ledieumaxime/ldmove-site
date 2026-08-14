import { beforeEach, describe, expect, it } from "vitest";
import {
  CompletedLog,
  ProgramItemLite,
  ProgramWeekLite,
  chooseWeek,
  clearChosenWeek,
  getChosenWeek,
  listProgramDays,
  nextDay,
  pendingDays,
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

  it("serves the session the client picked", () => {
    const logs = [...run("w1", "r1")];
    // Legs is up next but the client picked Handstand instead.
    expect(titleOf(nextDay(days, logs, "w4"))).toBe("Handstand");
    // Nothing was logged, so Legs is still what's owed next visit.
    expect(titleOf(nextDay(days, logs))).toBe("Legs");
  });

  it("lets the client start the next cycle when the last session is the one they can't do", () => {
    // Only Legs is still owed, and that's exactly the session their
    // sore legs rule out. They may run ahead on Push...
    const logs = [
      ...run("w1", "r1"),
      ...run("w3", "r3"),
      ...run("w4", "r4"),
    ];
    expect(titleOf(nextDay(days, logs, "w1"))).toBe("Push");
    // ...but Legs stays owed and comes straight back, so the loop
    // cannot close without it.
    const after = [...logs, ...run("w1", "r1c")];
    expect(titleOf(nextDay(days, after))).toBe("Legs");
  });

  it("ignores a pick pointing at a session the coach left empty", () => {
    const withEmpty = listProgramDays(weeks, items.filter((i) => i.week_id !== "w2"));
    expect(titleOf(nextDay(withEmpty, [], "w2"))).toBe("Push");
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

describe("chooseWeek", () => {
  const programId = "p1";

  beforeEach(() => sessionStorage.clear());

  it("remembers the pick across the hop to the workout page", () => {
    chooseWeek(programId, "w4");
    expect(getChosenWeek(programId)).toBe("w4");
  });

  it("lets the client change their mind back", () => {
    chooseWeek(programId, "w3");
    chooseWeek(programId, "w2");
    expect(getChosenWeek(programId)).toBe("w2");
  });

  it("is forgotten once a session is completed", () => {
    chooseWeek(programId, "w4");
    clearChosenWeek(programId);
    expect(getChosenWeek(programId)).toBeNull();
  });

  it("keeps blocks apart", () => {
    chooseWeek("blockA", "w1");
    expect(getChosenWeek("blockB")).toBeNull();
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

describe("what the skip dialog offers", () => {
  // Mirrors the dashboard: normally the other sessions still owed;
  // on the last one, the rest of the block (i.e. the next cycle).
  const optionsFor = (logs: CompletedLog[]) => {
    const pending = pendingDays(days, logs);
    const current = nextDay(days, logs);
    const pool = pending.length > 1 ? pending : days.filter((d) => !d.isEmpty);
    return pool.filter((d) => d.weekId !== current?.weekId);
  };

  it("offers the other sessions still owed", () => {
    expect(optionsFor([...run("w1", "r1")]).map((d) => d.weekTitle)).toEqual([
      "Pull",
      "Handstand",
    ]);
  });

  it("offers the next cycle rather than nothing on the last session", () => {
    const logs = [...run("w1", "r1"), ...run("w3", "r3"), ...run("w4", "r4")];
    expect(pendingDays(days, logs).map((d) => d.weekTitle)).toEqual(["Legs"]);
    expect(optionsFor(logs).map((d) => d.weekTitle)).toEqual([
      "Push",
      "Pull",
      "Handstand",
    ]);
  });
});
