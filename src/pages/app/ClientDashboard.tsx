import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  AlertCircle,
  Bell,
  Check,
  ClipboardList,
  Clock,
  Flame,
  MessageCircle,
  SkipForward,
  TrendingUp,
  Video,
} from "lucide-react";
import { sbGet, sbGetIn, sbPatch } from "@/integrations/supabase/api";
import BlockCalendar from "@/components/BlockCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeAnswers, visibleExercises } from "@/lib/assessment";
import {
  chooseWeek,
  dayDisplayLabel,
  getChosenWeek,
  listProgramDays,
  nextDay,
  pendingDays,
} from "@/lib/workoutDay";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "catalogue" | "custom";
  duration_weeks: number | null;
  created_at: string;
  is_archived: boolean;
  is_published: boolean;
  assigned_client_id: string | null;
};

type Comment = {
  id: string;
  item_id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  program_items?: { custom_name: string | null; week_id: string | null } | null;
};

type CommentRead = { item_id: string; last_read_at: string };

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read: boolean;
  created_at: string;
};

type ProgramWeekRef = {
  id: string;
  program_id: string;
  week_number: number;
  title: string | null;
};

type ProgramItemRef = {
  id: string;
  week_id: string;
  order_index: number;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  custom_name: string | null;
};

type SetLog = {
  program_item_id: string;
  session_run_id: string;
  session_date: string;
  completed_at: string | null;
  set_number: number;
  reps_done: number | null;
  weight_kg: number | string | null;
};

// ---- date helpers ----------------------------------------------------
const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const mondayOf = (d: Date) => {
  const copy = new Date(d);
  const diff = (copy.getDay() + 6) % 7; // Mon=0 … Sun=6
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
function formatSessionDate(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- section helpers -------------------------------------------------
// Exercise names carry their program section as a "[SECTION] Name"
// prefix (same convention as Today.tsx / ProgramDetail.tsx).
const stripSection = (name: string | null) =>
  (name ?? "").replace(/^\[[^\]]+\]\s*/, "").trim() || "Exercise";
const sectionOf = (name: string | null) => {
  const m = (name ?? "").match(/^\[([^\]]+)\]/);
  return m ? m[1].trim().toUpperCase() : "EXERCISES";
};
const isWarmupSection = (s: string) => s.includes("WARM");

// In-memory snapshot of the last successful dashboard fetch, per
// client. On remount (Today → back to Home, etc.) the page renders
// instantly from the snapshot while a background refetch replaces it,
// so navigation feels immediate instead of showing a spinner on every
// visit. Module state: cleared on a full page reload.
type DashboardSnapshot = {
  programs: Program[];
  comments: Comment[];
  reads: CommentRead[];
  hasIntake: boolean;
  intakeAnswers: IntakeAnswers | null;
  onboardingLocked: boolean;
  assessmentCount: number;
  notifications: Notification[];
  programWeeks: ProgramWeekRef[];
  programItems: ProgramItemRef[];
  completedLogs: SetLog[];
};
const dashboardCache = new Map<string, DashboardSnapshot>();

/**
 * The client's own dashboard. Thin wrapper: the body is shared with the
 * coach's "view as client" page (/app/admin/clients/:id/dashboard) so
 * both always render exactly the same thing.
 */
const ClientDashboard = () => {
  const { profile, user } = useAuth();
  if (!user) return null;
  return (
    <ClientDashboardBody
      clientId={user.id}
      firstName={profile?.first_name ?? ""}
    />
  );
};

export const ClientDashboardBody = ({
  clientId,
  firstName,
  coachView = false,
}: {
  clientId: string;
  firstName: string;
  coachView?: boolean;
}) => {
  const navigate = useNavigate();
  const cacheKey = `${clientId}|${coachView ? "coach" : "self"}`;
  const cached = dashboardCache.get(cacheKey);
  const [programs, setPrograms] = useState<Program[]>(cached?.programs ?? []);
  const [comments, setComments] = useState<Comment[]>(cached?.comments ?? []);
  const [reads, setReads] = useState<CommentRead[]>(cached?.reads ?? []);
  const [hasIntake, setHasIntake] = useState(cached?.hasIntake ?? true);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers | null>(
    cached?.intakeAnswers ?? null
  );
  const [onboardingLocked, setOnboardingLocked] = useState(
    cached?.onboardingLocked ?? false
  );
  const [assessmentCount, setAssessmentCount] = useState(
    cached?.assessmentCount ?? 0
  );
  const [notifications, setNotifications] = useState<Notification[]>(
    cached?.notifications ?? []
  );
  const [programWeeks, setProgramWeeks] = useState<ProgramWeekRef[]>(
    cached?.programWeeks ?? []
  );
  const [programItems, setProgramItems] = useState<ProgramItemRef[]>(
    cached?.programItems ?? []
  );
  const [completedLogs, setCompletedLogs] = useState<SetLog[]>(
    cached?.completedLogs ?? []
  );
  const [loading, setLoading] = useState(!cached);
  // The picked session lives in sessionStorage (shared with the
  // workout page); this counter just forces a re-render on a pick.
  const [, setDeferTick] = useState(0);
  const [skipOpen, setSkipOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const [p, co, r, intake, av, notifs] = await Promise.all([
          sbGet<Program[]>(
            `programs?select=*&or=(type.eq.catalogue,and(type.eq.custom,assigned_client_id.eq.${clientId}))&order=created_at.desc`
          ),
          // In coach view the RLS would surface every client's comments,
          // so we re-fetch scoped to the program's items further down.
          coachView
            ? Promise.resolve([] as Comment[])
            : sbGet<Comment[]>(
                `exercise_comments?select=*,program_items(custom_name,week_id)&author_role=eq.coach&order=created_at.desc&limit=20`
              ),
          // comment_reads are per-user; meaningless for the coach.
          coachView
            ? Promise.resolve([] as CommentRead[])
            : sbGet<CommentRead[]>(
                `comment_reads?select=item_id,last_read_at&user_id=eq.${clientId}`
              ),
          coachView
            ? Promise.resolve(
                [] as (IntakeAnswers & { locked_at: string | null })[]
              )
            : sbGet<(IntakeAnswers & { locked_at: string | null })[]>(
                `client_intakes?select=max_pull_ups,max_dips,max_push_ups,deep_squat,handstand,muscle_up,planche,front_lever,lsit_vsit,hspu,rope_climb,hamstrings,splits,shoulder_mobility,squat_flat_heels,backbend,locked_at&client_id=eq.${clientId}&limit=1`
              ),
          coachView
            ? Promise.resolve([] as Array<{ id: string }>)
            : sbGet<Array<{ id: string }>>(
                `assessment_videos?select=id&client_id=eq.${clientId}`
              ),
          coachView
            ? Promise.resolve([] as Notification[])
            : sbGet<Notification[]>(
                `notifications?user_id=eq.${clientId}&read=eq.false&select=id,type,title,body,link_url,read,created_at&order=created_at.desc`
              ),
        ]);
        setPrograms(p);
        setComments(co);
        setReads(r);
        setHasIntake(coachView ? true : intake.length > 0);
        setIntakeAnswers(intake[0] ?? null);
        setOnboardingLocked(!!intake[0]?.locked_at);
        setAssessmentCount(av.length);
        setNotifications(notifs);

        // Progress data: scoped to the CURRENT program only, to stay
        // well under PostgREST's ~1000-row cap for long-time clients.
        const current = p.find(
          (x) =>
            x.type === "custom" &&
            x.assigned_client_id === clientId &&
            !x.is_archived &&
            x.is_published
        );
        let weeksOut: ProgramWeekRef[] = [];
        let itemsOut: ProgramItemRef[] = [];
        let logsOut: SetLog[] = [];
        let commentsOut: Comment[] = co;
        if (current) {
          // One embedded request replaces the old weeks → items → logs
          // waterfall (3+ serial round trips): every week with its
          // items, every item with this client's completed logs. Only
          // the top level is subject to the server's row cap and that's
          // just the handful of program_weeks rows.
          type WeekEmbed = ProgramWeekRef & {
            program_items:
              | (ProgramItemRef & { workout_logs: SetLog[] | null })[]
              | null;
          };
          const weeks = await sbGet<WeekEmbed[]>(
            `program_weeks?select=id,program_id,week_number,title,` +
              `program_items(id,week_id,order_index,sets,reps,rest_seconds,custom_name,` +
              `workout_logs(program_item_id,session_run_id,session_date,completed_at,set_number,reps_done,weight_kg))` +
              `&program_id=eq.${current.id}&order=week_number.asc` +
              `&program_items.workout_logs.client_id=eq.${clientId}` +
              `&program_items.workout_logs.completed_at=not.is.null`
          );
          weeksOut = weeks.map(({ program_items: _pi, ...w }) => w);
          itemsOut = weeks.flatMap((w) =>
            (w.program_items ?? []).map(({ workout_logs: _wl, ...it }) => it)
          );
          logsOut = weeks.flatMap((w) =>
            (w.program_items ?? []).flatMap((i) => i.workout_logs ?? [])
          );
          if (coachView && itemsOut.length > 0) {
            const cs = await sbGetIn<Comment>(
              `exercise_comments?select=*,program_items(custom_name,week_id)&author_role=eq.coach`,
              "item_id",
              itemsOut.map((i) => i.id)
            );
            cs.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
            commentsOut = cs;
          }
        }
        setProgramWeeks(weeksOut);
        setProgramItems(itemsOut);
        setCompletedLogs(logsOut);
        if (coachView) setComments(commentsOut);

        dashboardCache.set(cacheKey, {
          programs: p,
          comments: commentsOut,
          reads: r,
          hasIntake: coachView ? true : intake.length > 0,
          intakeAnswers: intake[0] ?? null,
          onboardingLocked: !!intake[0]?.locked_at,
          assessmentCount: av.length,
          notifications: notifs,
          programWeeks: weeksOut,
          programItems: itemsOut,
          completedLogs: logsOut,
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, coachView]);

  const dismissAndGo = async (n: Notification) => {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await sbPatch(`notifications?id=eq.${n.id}`, { read: true });
    } catch {
      // If marking-read fails we still proceed with navigation.
    }
    if (n.link_url) navigate(n.link_url);
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  const now = Date.now();

  // Current active custom program (first non-archived published one)
  const currentProgram = programs.find(
    (p) =>
      p.type === "custom" &&
      p.assigned_client_id === clientId &&
      !p.is_archived &&
      p.is_published
  );

  const archivedCount = programs.filter(
    (p) =>
      p.type === "custom" &&
      p.assigned_client_id === clientId &&
      p.is_archived
  ).length;

  const programItemsByWeek: Record<string, string> = Object.fromEntries(
    programItems.map((i) => [i.id, i.week_id])
  );
  const itemById = new Map(programItems.map((i) => [i.id, i]));

  // Unread coach comments: coach comments newer than the client's
  // last_read_at for that item. Always empty in coach view.
  const readsByItem = new Map(reads.map((r) => [r.item_id, r.last_read_at]));
  const unreadComments = coachView
    ? []
    : comments.filter((c) => {
        const lastRead = readsByItem.get(c.item_id);
        if (!lastRead) return true;
        return new Date(c.created_at).getTime() > new Date(lastRead).getTime();
      });
  const latestCoachComment = comments[0] ?? null;

  // Progress of current program: based on workout completions, not calendar.
  let progress = 0;
  let daysLeft = 0;
  let isOverdue = false;
  let totalSessionsCompleted = 0;
  let sessionsPerLoop = 0;
  let expectedTotal = 0;
  if (currentProgram) {
    const programWeekIds = new Set(
      programWeeks
        .filter((w) => w.program_id === currentProgram.id)
        .map((w) => w.id)
    );
    sessionsPerLoop = programWeekIds.size;

    const completionsKey = new Set<string>();
    for (const log of completedLogs) {
      const weekId = programItemsByWeek[log.program_item_id];
      if (!weekId || !programWeekIds.has(weekId)) continue;
      completionsKey.add(log.session_run_id);
    }
    totalSessionsCompleted = completionsKey.size;

    const start = new Date(currentProgram.created_at).getTime();
    const weeks = currentProgram.duration_weeks ?? 5;
    expectedTotal = sessionsPerLoop * weeks;

    if (expectedTotal > 0) {
      progress = Math.min(100, (totalSessionsCompleted / expectedTotal) * 100);
    }

    const end = start + weeks * 7 * 86_400_000;
    daysLeft = Math.ceil((end - now) / 86_400_000);
    isOverdue = daysLeft < 0;
  }

  // Blocks offered in the calendar picker: the client's own custom
  // blocks, current one first. Archived ones are kept so they can look
  // back at what they did.
  const calendarBlocks = programs
    .filter((p) => p.type === "custom" && p.assigned_client_id === clientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p) => ({
      id: p.id,
      title: p.title,
      isCurrent: p.id === currentProgram?.id,
    }));

  const currentLoopWeek =
    sessionsPerLoop > 0
      ? Math.floor(totalSessionsCompleted / sessionsPerLoop) + 1
      : 1;

  // Distinct completed runs grouped by week-monday, for the streak.
  // The old "This week" day strip was dropped when the block calendar
  // arrived: it showed the same thing over seven days instead of the
  // whole block.
  const runDates = new Map<string, string>(); // run_id → session_date
  for (const l of completedLogs) {
    if (!l.completed_at) continue;
    if (!runDates.has(l.session_run_id))
      runDates.set(l.session_run_id, l.session_date);
  }
  const runsByWeek = new Map<string, number>(); // monday ISO → distinct runs
  for (const date of runDates.values()) {
    const wk = toISO(mondayOf(new Date(date + "T12:00:00")));
    runsByWeek.set(wk, (runsByWeek.get(wk) ?? 0) + 1);
  }

  // Streak: consecutive weeks (walking back) hitting the weekly target.
  // The target is deliberately softer than the program's full session
  // count: 3 sessions/week keeps the streak (coach's call, 2026-07-13),
  // otherwise clients on 5-session blocks who train 3-4x would sit at
  // zero forever and the pill would lose its pull. Programs with fewer
  // than 3 sessions per loop use their own count.
  const streakTarget = Math.min(3, sessionsPerLoop);
  let streakWeeks = 0;
  if (streakTarget > 0) {
    const cursor = mondayOf(new Date());
    if ((runsByWeek.get(toISO(cursor)) ?? 0) >= streakTarget) streakWeeks++;
    for (let i = 1; i < 104; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - 7 * i);
      if ((runsByWeek.get(toISO(d)) ?? 0) >= streakTarget) streakWeeks++;
      else break;
    }
  }

  // ---- Runs in chronological order, for PRs + last session ------------
  type RunAgg = {
    runId: string;
    date: string;
    completedAt: number;
    weekId: string | null;
    byItem: Map<string, SetLog[]>;
  };
  const runsById = new Map<string, RunAgg>();
  for (const log of completedLogs) {
    if (!log.completed_at) continue;
    let run = runsById.get(log.session_run_id);
    if (!run) {
      run = {
        runId: log.session_run_id,
        date: log.session_date,
        completedAt: 0,
        weekId: programItemsByWeek[log.program_item_id] ?? null,
        byItem: new Map(),
      };
      runsById.set(log.session_run_id, run);
    }
    run.completedAt = Math.max(
      run.completedAt,
      new Date(log.completed_at).getTime()
    );
    const arr = run.byItem.get(log.program_item_id) ?? [];
    arr.push(log);
    run.byItem.set(log.program_item_id, arr);
  }
  const runsOrdered = [...runsById.values()].sort(
    (a, b) => a.completedAt - b.completedAt
  );

  // PR detection, per exercise NAME (the same exercise lives as a
  // different program_item row in every week of the block). A run scores
  // a PR on an exercise when its best set beats the best of all previous
  // runs: heavier load wins; for unloaded exercises, more reps/seconds
  // wins. Warmup sections never count.
  type Best = { weight: number | null; reps: number | null };
  const bestByName = new Map<string, Best>();
  const prKeys = new Set<string>(); // `${runId}|${nameLower}`
  let prsThisBlock = 0;
  let prsThisWeek = 0;
  const currentWeekMonday = toISO(mondayOf(new Date()));
  for (const run of runsOrdered) {
    const runMax = new Map<string, Best>();
    for (const [itemId, logs] of run.byItem) {
      const item = itemById.get(itemId);
      if (!item) continue;
      if (isWarmupSection(sectionOf(item.custom_name))) continue;
      const name = stripSection(item.custom_name).toLowerCase();
      const cur = runMax.get(name) ?? { weight: null, reps: null };
      for (const l of logs) {
        if (l.weight_kg != null)
          cur.weight = Math.max(cur.weight ?? 0, Number(l.weight_kg));
        if (l.reps_done != null)
          cur.reps = Math.max(cur.reps ?? 0, l.reps_done);
      }
      runMax.set(name, cur);
    }
    for (const [name, m] of runMax) {
      const prev = bestByName.get(name);
      let isPr = false;
      if (prev) {
        if (m.weight != null && prev.weight != null && m.weight > prev.weight)
          isPr = true;
        else if (m.weight != null && prev.weight == null) isPr = true;
        else if (
          m.weight == null &&
          prev.weight == null &&
          m.reps != null &&
          prev.reps != null &&
          m.reps > prev.reps
        )
          isPr = true;
      }
      if (isPr) {
        prsThisBlock++;
        prKeys.add(`${run.runId}|${name}`);
        if (
          toISO(mondayOf(new Date(run.date + "T12:00:00"))) ===
          currentWeekMonday
        )
          prsThisWeek++;
      }
      const merged = prev ?? { weight: null, reps: null };
      if (m.weight != null)
        merged.weight = Math.max(merged.weight ?? m.weight, m.weight);
      if (m.reps != null) merged.reps = Math.max(merged.reps ?? m.reps, m.reps);
      bestByName.set(name, merged);
    }
  }

  // ---- Last session summary (workout sections only, no warmup) --------
  const lastRun = runsOrdered[runsOrdered.length - 1] ?? null;
  type LastExercise = { id: string; name: string; perf: string; isPr: boolean };
  let lastSession: {
    label: string;
    when: string;
    exercises: LastExercise[];
  } | null = null;
  if (lastRun) {
    const entries = [...lastRun.byItem.entries()]
      .map(([itemId, logs]) => ({ item: itemById.get(itemId), logs }))
      .filter(
        (e): e is { item: ProgramItemRef; logs: SetLog[] } =>
          !!e.item && !isWarmupSection(sectionOf(e.item.custom_name))
      )
      .sort((a, b) => a.item.order_index - b.item.order_index);
    const exercises: LastExercise[] = entries.map(({ item, logs }) => {
      const name = stripSection(item.custom_name);
      const setsCount = new Set(logs.map((l) => l.set_number)).size;
      let maxW: number | null = null;
      let maxR: number | null = null;
      for (const l of logs) {
        if (l.weight_kg != null) maxW = Math.max(maxW ?? 0, Number(l.weight_kg));
        if (l.reps_done != null) maxR = Math.max(maxR ?? 0, l.reps_done);
      }
      const prescription = item.reps ?? "";
      const inSeconds = /\d+\s*(s|sec|secs|seconds)\b/i.test(prescription);
      const isMaxEffort = /max|amrap/i.test(prescription);
      let perf = "";
      if (maxR != null) {
        perf = isMaxEffort
          ? `best ${maxR}${inSeconds ? " s" : ""}`
          : `${setsCount}×${maxR}${inSeconds ? " s" : ""}`;
      } else if (setsCount > 0) {
        perf = `${setsCount} set${setsCount > 1 ? "s" : ""}`;
      }
      if (maxW != null) perf += `${perf ? " · " : ""}${maxW} kg`;
      return {
        id: item.id,
        name,
        perf,
        isPr: prKeys.has(`${lastRun.runId}|${name.toLowerCase()}`),
      };
    });
    if (exercises.length > 0) {
      const week = programWeeks.find((w) => w.id === lastRun.weekId);
      lastSession = {
        label: week?.title?.trim()
          ? week.title.trim()
          : week
            ? `Session ${week.week_number}`
            : "Session",
        when: formatSessionDate(lastRun.date),
        exercises,
      };
    }
  }

  // Next session: same rule as the Today page, minus anything the
  // client pushed back with "Not today" during this visit.
  const programDays = currentProgram
    ? listProgramDays(programWeeks, programItems)
    : [];
  const chosenWeek =
    currentProgram && !coachView ? getChosenWeek(currentProgram.id) : null;
  const nextSession = nextDay(programDays, completedLogs, chosenWeek);
  const pending = pendingDays(programDays, completedLogs);
  // What the client can jump to. Normally the other sessions still
  // owed this cycle, so a skip reorders the block without letting a
  // session be dropped. On the last one owed there would be nothing
  // left to offer, and that is exactly when a client with wrecked legs
  // closes the app instead of training: they get the next cycle
  // instead. The session they owe stays owed either way.
  const isLastOfCycle = pending.length <= 1;
  const skipPool = isLastOfCycle
    ? programDays.filter((d) => !d.isEmpty)
    : pending;
  const skipOptions = skipPool.filter((d) => d.weekId !== nextSession?.weekId);
  const nextSessionLabel = nextSession ? dayDisplayLabel(nextSession) : null;
  const nextSessionExerciseCount = nextSession?.items.length ?? 0;
  // Duration estimate: ~45s of work per set + the prescribed rest per
  // set. Rounded to the nearest 5 minutes; floor of 15.
  const nextSessionMinutes = (() => {
    if (!nextSession || nextSession.items.length === 0) return null;
    let seconds = 0;
    for (const raw of nextSession.items) {
      const it = raw as unknown as ProgramItemRef;
      const sets = it.sets ?? 3;
      const rest = it.rest_seconds ?? 45;
      seconds += sets * 45 + sets * rest;
    }
    const mins = Math.max(15, Math.round(seconds / 60 / 5) * 5);
    return Math.min(mins, 120);
  })();

  return (
    <div className="space-y-5">
      {/* Header + streak pill */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">
            {currentProgram
              ? `${currentProgram.title} · Week ${currentLoopWeek}`
              : "Welcome"}
          </p>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Hi {firstName}
          </h1>
        </div>
        {currentProgram && sessionsPerLoop > 0 && (
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 mt-1 shrink-0 ${
              streakWeeks > 0
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-muted/40 border-border text-muted-foreground"
            }`}
          >
            <Flame size={14} />
            <span className="text-xs font-semibold whitespace-nowrap">
              {streakWeeks > 0
                ? `${streakWeeks}-week streak`
                : "Start your streak"}
            </span>
          </div>
        )}
      </div>

      {!coachView && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => dismissAndGo(n)}
              className="w-full text-left bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3 hover:bg-accent/15 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm">{n.title}</p>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {n.body}
                  </p>
                )}
              </div>
              <ArrowRight size={16} className="text-accent mt-1 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Onboarding banner — guides the client through the two onboarding steps */}
      {!coachView &&
        (() => {
          if (onboardingLocked) return null;
          if (!hasIntake) {
            return (
              <OnboardingBanner
                to="/app/onboarding/intake"
                icon={<ClipboardList size={20} />}
                tag="Start here"
                title="Complete your intake form"
                desc="5 minutes to tell me where you are today. This is what I use to design your first program."
              />
            );
          }
          const expected = intakeAnswers
            ? visibleExercises(intakeAnswers).length
            : 0;
          if (expected > 0 && assessmentCount < expected) {
            return (
              <OnboardingBanner
                to="/app/onboarding/assessment"
                icon={<Video size={20} />}
                tag="Step 2"
                title={`Upload your assessment videos (${assessmentCount}/${expected})`}
                desc="Film the exercises I need to see. I'll use them to validate your level and build the right program."
              />
            );
          }
          return null;
        })()}

      {/* Up next hero */}
      {currentProgram ? (
        <div className="bg-foreground text-background rounded-2xl p-5 md:p-6">
          <p className="text-xs uppercase tracking-wider opacity-70 font-semibold mb-1">
            Up next
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-1">
            {nextSessionLabel ?? currentProgram.title}
          </h2>
          {nextSession && (
            <p className="text-sm opacity-70 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList size={14} /> {nextSessionExerciseCount} exercise
                {nextSessionExerciseCount === 1 ? "" : "s"}
              </span>
              {nextSessionMinutes != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} /> ~{nextSessionMinutes} min
                </span>
              )}
              <span className="opacity-70">{currentProgram.title}</span>
            </p>
          )}

          {coachView ? (
            <p className="text-xs opacity-60 mt-4">
              This is the session {firstName || "the client"} will see on
              their Today page.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 flex-wrap mt-4">
                <Link
                  to="/app/today"
                  className="inline-flex items-center justify-center gap-2 bg-accent text-white font-semibold rounded-full px-5 py-3 text-sm hover:opacity-95 transition w-full sm:w-auto"
                >
                  Start Session {totalSessionsCompleted + 1}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to={`/app/programs/${currentProgram.slug}`}
                  className="text-xs opacity-60 hover:opacity-100 underline underline-offset-4"
                >
                  Preview program
                </Link>
              </div>
              {/* The swap is decided here, before opening the session:
                  the client sees what is coming and says no to it,
                  rather than starting it and backing out. */}
              {skipOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSkipOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 underline underline-offset-4 mt-3"
                >
                  <SkipForward size={12} /> Skip session
                </button>
              )}
              {chosenWeek && (
                <p className="text-xs opacity-60 mt-3">
                  You picked this one for today. What you skipped is still
                  owed before this block loops.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-heading text-xl font-bold mb-2">
            No active program
          </h2>
          <p className="text-sm text-muted-foreground">
            {coachView
              ? "This client has no active published block right now."
              : "Your coach hasn't assigned an active program yet. Check the catalogue below or get in touch."}
          </p>
        </div>
      )}

      {/* Skip dialog: pick the session, but read why order matters
          first. The warning is the point — skipping is allowed, not
          encouraged. */}
      {skipOpen && currentProgram && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSkipOpen(false)}
          />
          <div className="fixed z-50 inset-x-4 top-[10%] max-w-md mx-auto bg-white border border-border rounded-2xl shadow-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div>
              <h2 className="font-heading text-lg font-bold">Skip session</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Your block is built in a set order: the sessions balance
                each other across the week, and following that order is
                what makes it work. Skipping now and then is fine when
                life gets in the way. Making a habit of it is not, and
                your coach will see it.
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {isLastOfCycle
                  ? `${nextSessionLabel ?? "This session"} is the last one of your current cycle. You can start the next one, but you still have to come back and do it before this cycle closes.`
                  : "Whatever you skip is not lost. It comes back and you still have to do it before this block loops."}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Train this instead
              </p>
              <ul className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                {skipOptions.map((d) => (
                  <li key={d.weekId}>
                    <button
                      type="button"
                      onClick={() => {
                        chooseWeek(currentProgram.id, d.weekId);
                        setSkipOpen(false);
                        setDeferTick((n) => n + 1);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/40 flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-semibold">
                        {/* The position matters: a PPL block repeats
                            "Push" and "Pull", so the name alone can't
                            tell two sessions apart. */}
                        <span className="text-muted-foreground mr-1.5">
                          {d.weekNumber}.
                        </span>
                        {dayDisplayLabel(d)}
                      </span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {d.items.length} exercise
                        {d.items.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSkipOpen(false)}
                className="text-xs font-semibold border border-border rounded-full px-4 py-2 hover:bg-muted/50"
              >
                Keep {nextSessionLabel ?? "my session"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Training calendar for the block, with access to past blocks */}
      {calendarBlocks.length > 0 && (
        <BlockCalendar
          clientId={clientId}
          blocks={calendarBlocks}
          currentLogs={completedLogs}
        />
      )}

      {/* Block progress + PRs tiles */}
      {currentProgram && expectedTotal > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
            {(() => {
              const pct = Math.min(1, totalSessionsCompleted / expectedTotal);
              const C = 2 * Math.PI * 18;
              return (
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 52 52"
                  className="shrink-0"
                >
                  <circle
                    cx="26"
                    cy="26"
                    r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    className="text-border"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    className={isOverdue ? "text-red-400" : "text-accent"}
                    strokeDasharray={`${Math.round(pct * C)} ${Math.round(C)}`}
                    transform="rotate(-90 26 26)"
                  />
                  <text
                    x="26"
                    y="30"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="currentColor"
                    className="text-foreground"
                  >
                    {Math.round(progress)}%
                  </text>
                </svg>
              );
            })()}
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm">Block</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {totalSessionsCompleted >= expectedTotal
                  ? "All sessions done"
                  : `Session ${totalSessionsCompleted + 1} of ${expectedTotal}`}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="w-[52px] h-[52px] rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <TrendingUp size={22} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm">
                {prsThisBlock} PR{prsThisBlock === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {prsThisWeek > 0
                  ? `+${prsThisWeek} this week`
                  : prsThisBlock > 0
                    ? "this block"
                    : "Beat a past best"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last session summary — workout exercises only */}
      {lastSession && (
        <div className="bg-white rounded-2xl border border-border p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              Last session
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {lastSession.label} · {lastSession.when}
            </span>
          </div>
          <ul>
            {lastSession.exercises.slice(0, 5).map((ex) => (
              <li
                key={ex.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
              >
                <span className="text-sm truncate">{ex.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                  {ex.perf}
                  {ex.isPr && (
                    <span className="bg-accent/10 text-accent font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                      PR
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">
            {lastSession.exercises.length > 5 && (
              <>+ {lastSession.exercises.length - 5} more exercises · </>
            )}
            {coachView ? (
              <span>full log on the client page</span>
            ) : (
              <Link
                to="/app/history"
                className="text-accent font-semibold hover:underline"
              >
                View full log
              </Link>
            )}
          </p>
        </div>
      )}

      {/* Latest coach note */}
      {latestCoachComment &&
        (() => {
          const exName = latestCoachComment.program_items?.custom_name
            ? stripSection(latestCoachComment.program_items.custom_name)
            : null;
          const inner = (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
                <MessageCircle size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  Note from your coach
                  {unreadComments.length > 0 && (
                    <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadComments.length} new
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {exName ? `${exName}: ` : ""}
                  {latestCoachComment.body}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatRelative(latestCoachComment.created_at, now)}
              </span>
            </div>
          );
          const cardClass = `block rounded-2xl border p-4 ${
            unreadComments.length > 0
              ? "bg-accent/10 border-accent/40"
              : "bg-white border-border"
          }`;
          return coachView ? (
            <div className={cardClass}>{inner}</div>
          ) : (
            <Link
              to="/app/inbox#messages"
              className={`${cardClass} hover:shadow-md transition`}
            >
              {inner}
            </Link>
          );
        })()}

      {/* Program ending / overdue warning */}
      {!coachView && currentProgram && (isOverdue || daysLeft <= 7) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              {isOverdue
                ? "Your program has ended. Time to check in with your coach"
                : `Your program ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`}
            </p>
            <p className="text-amber-800 mt-0.5">
              Drop a message in any exercise's comments and Maxime will pick it
              up.
            </p>
          </div>
        </div>
      )}

      {/* Archived programs */}
      {!coachView && archivedCount > 0 && (
        <Link
          to="/app/archived"
          className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-3 hover:shadow-md transition"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Archive size={15} className="text-muted-foreground" /> Archived
            programs
          </span>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            {archivedCount} <ArrowRight size={12} />
          </span>
        </Link>
      )}
    </div>
  );
};

function formatRelative(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const OnboardingBanner = ({
  to,
  icon,
  tag,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  desc: string;
}) => (
  <Link
    to={to}
    className="block bg-accent/10 border-2 border-accent/40 text-foreground rounded-2xl p-5 hover:bg-accent/15 transition"
  >
    <div className="flex items-start gap-4">
      <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider font-semibold text-accent">
          {tag}
        </p>
        <h2 className="font-heading text-xl font-bold mt-0.5">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
      <ArrowRight size={20} className="text-accent shrink-0 mt-2" />
    </div>
  </Link>
);

export default ClientDashboard;
