import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Dumbbell,
  MessageCircle,
  Archive,
  ArrowRight,
  AlertCircle,
  Check,
  ClipboardList,
  Clock,
  Flame,
  Video,
  Bell,
} from "lucide-react";
import { sbGet, sbGetIn, sbPatch } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeAnswers, visibleExercises } from "@/lib/assessment";
import {
  dayDisplayLabel,
  listProgramDays,
  nextDay,
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

type FormCheck = {
  id: string;
  status: "pending" | "reviewed";
  created_at: string;
};

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
  rest_seconds: number | null;
};

type CompletionLog = {
  program_item_id: string;
  session_run_id: string;
  session_date: string;
  completed_at: string | null;
};

const ClientDashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reads, setReads] = useState<CommentRead[]>([]);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [hasIntake, setHasIntake] = useState(true);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers | null>(null);
  const [onboardingLocked, setOnboardingLocked] = useState(false);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [programWeeks, setProgramWeeks] = useState<ProgramWeekRef[]>([]);
  const [programItemsByWeek, setProgramItemsByWeek] = useState<
    Record<string, string>
  >({}); // item_id → week_id
  const [programItems, setProgramItems] = useState<ProgramItemRef[]>([]);
  const [completedLogs, setCompletedLogs] = useState<CompletionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [p, co, r, fc, intake, av, notifs] = await Promise.all([
          sbGet<Program[]>(
            `programs?select=*&or=(type.eq.catalogue,and(type.eq.custom,assigned_client_id.eq.${user.id}))&order=created_at.desc`
          ),
          sbGet<Comment[]>(
            `exercise_comments?select=*,program_items(custom_name,week_id)&author_role=eq.coach&order=created_at.desc&limit=20`
          ),
          sbGet<CommentRead[]>(
            `comment_reads?select=item_id,last_read_at&user_id=eq.${user.id}`
          ),
          sbGet<FormCheck[]>(
            `form_check_submissions?select=id,status,created_at&client_id=eq.${user.id}&order=created_at.desc&limit=10`
          ),
          sbGet<(IntakeAnswers & { locked_at: string | null })[]>(
            `client_intakes?select=max_pull_ups,max_dips,max_push_ups,deep_squat,handstand,muscle_up,planche,front_lever,lsit_vsit,hspu,rope_climb,hamstrings,splits,shoulder_mobility,squat_flat_heels,backbend,locked_at&client_id=eq.${user.id}&limit=1`
          ),
          sbGet<Array<{ id: string }>>(
            `assessment_videos?select=id&client_id=eq.${user.id}`
          ),
          sbGet<Notification[]>(
            `notifications?user_id=eq.${user.id}&read=eq.false&select=id,type,title,body,link_url,read,created_at&order=created_at.desc`
          ),
        ]);
        setPrograms(p);
        setComments(co);
        setReads(r);
        setChecks(fc);
        setHasIntake(intake.length > 0);
        setIntakeAnswers(intake[0] ?? null);
        setOnboardingLocked(!!intake[0]?.locked_at);
        setAssessmentCount(av.length);
        setNotifications(notifs);

        // Progress data: scoped to the CURRENT program only. The old
        // version fetched every program_weeks / program_items row the
        // RLS would let us read (all catalogue + all of the client's
        // archived blocks) plus every completed workout_log with no
        // limit — all three quietly truncate at PostgREST's ~1000-row
        // cap once a long-time client accumulates history, which
        // corrupts the progress math.
        const current = p.find(
          (x) =>
            x.type === "custom" &&
            x.assigned_client_id === user.id &&
            !x.is_archived &&
            x.is_published
        );
        if (current) {
          const weeks = await sbGet<ProgramWeekRef[]>(
            `program_weeks?select=id,program_id,week_number,title&program_id=eq.${current.id}&order=week_number.asc`
          );
          setProgramWeeks(weeks);
          const items =
            weeks.length > 0
              ? await sbGetIn<ProgramItemRef>(
                  `program_items?select=id,week_id,order_index,sets,rest_seconds`,
                  "week_id",
                  weeks.map((w) => w.id)
                )
              : [];
          setProgramItems(items);
          setProgramItemsByWeek(
            Object.fromEntries(items.map((i) => [i.id, i.week_id]))
          );
          const logs =
            items.length > 0
              ? await sbGetIn<CompletionLog>(
                  `workout_logs?client_id=eq.${user.id}&completed_at=not.is.null&select=program_item_id,session_run_id,session_date,completed_at`,
                  "program_item_id",
                  items.map((i) => i.id)
                )
              : [];
          setCompletedLogs(logs);
        } else {
          setProgramWeeks([]);
          setProgramItems([]);
          setProgramItemsByWeek({});
          setCompletedLogs([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

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
      p.assigned_client_id === user?.id &&
      !p.is_archived &&
      p.is_published
  );

  const archivedCount = programs.filter(
    (p) =>
      p.type === "custom" &&
      p.assigned_client_id === user?.id &&
      p.is_archived
  ).length;

  // Unread coach comments: coach comments whose created_at > user's last_read_at for that item
  const readsByItem = new Map(reads.map((r) => [r.item_id, r.last_read_at]));
  const unreadComments = comments.filter((c) => {
    const lastRead = readsByItem.get(c.item_id);
    if (!lastRead) return true;
    return new Date(c.created_at).getTime() > new Date(lastRead).getTime();
  });

  // Progress of current program: based on workout completions, not calendar.
  //   T = total sessions ever completed for this block (distinct
  //       (week_id, session_date) tuples in workout_logs.completed_at)
  //   N = number of sessions in the block (program_weeks count)
  //   D = block calendar duration in weeks (programs.duration_weeks)
  //   expectedTotal = N × D                    (1 loop per week assumption)
  //   expectedByNow = N × (days_elapsed / 7)   (linear pace)
  //   progress = min(100, T / expectedTotal × 100)
  // If the client skips, T stagnates and the bar simply doesn't move —
  // the "behind by X workouts" subtitle nudges them.
  let progress = 0;
  let daysLeft = 0;
  let isOverdue = false;
  let totalSessionsCompleted = 0;
  let sessionsPerLoop = 0;
  let expectedTotal = 0;
  let workoutsBehind = 0; // positive = behind, negative = ahead
  if (currentProgram) {
    const programWeekIds = new Set(
      programWeeks.filter((w) => w.program_id === currentProgram.id).map((w) => w.id)
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

    const daysElapsed = Math.max(0, (now - start) / 86_400_000);
    const expectedByNow = (sessionsPerLoop * daysElapsed) / 7;
    workoutsBehind = Math.round(expectedByNow - totalSessionsCompleted);

    const end = start + weeks * 7 * 86_400_000;
    daysLeft = Math.ceil((end - now) / 86_400_000);
    isOverdue = daysLeft < 0;
  }

  // ---- Week strip / streak / next session (Trainerize-style) ----------
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

  const weekDays: { iso: string; label: string; isToday: boolean }[] = [];
  {
    const monday = mondayOf(new Date());
    const todayIso = toISO(new Date());
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toISO(d);
      weekDays.push({ iso, label: labels[i], isToday: iso === todayIso });
    }
  }

  // Distinct completed runs, grouped by session_date and by week-monday.
  const runDates = new Map<string, string>(); // run_id → session_date
  for (const l of completedLogs) {
    if (!l.completed_at) continue;
    if (!runDates.has(l.session_run_id)) runDates.set(l.session_run_id, l.session_date);
  }
  const datesWithSession = new Set(runDates.values());
  const runsByWeek = new Map<string, number>(); // monday ISO → distinct runs
  for (const date of runDates.values()) {
    const wk = toISO(mondayOf(new Date(date + "T12:00:00")));
    runsByWeek.set(wk, (runsByWeek.get(wk) ?? 0) + 1);
  }
  const doneThisWeek = runsByWeek.get(weekDays[0].iso) ?? 0;

  // Streak: consecutive weeks (walking back) hitting the weekly target.
  // The current week counts once it reaches the target; otherwise the
  // streak is measured from last week backwards so an in-progress week
  // doesn't break it.
  let streakWeeks = 0;
  if (sessionsPerLoop > 0) {
    const cursor = mondayOf(new Date());
    if ((runsByWeek.get(toISO(cursor)) ?? 0) >= sessionsPerLoop) streakWeeks++;
    for (let i = 1; i < 104; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - 7 * i);
      if ((runsByWeek.get(toISO(d)) ?? 0) >= sessionsPerLoop) streakWeeks++;
      else break;
    }
  }

  // Next session: same modulo logic as the Today page, so the dashboard
  // card and the workout page always agree.
  const programDays = currentProgram
    ? listProgramDays(programWeeks, programItems)
    : [];
  const nextSession = nextDay(programDays, completedLogs);
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

  const pendingChecks = checks.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Welcome</p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          Hi {profile?.first_name ?? ""}
        </h1>
      </div>

      {notifications.length > 0 && (
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
      {(() => {
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
        const expected = intakeAnswers ? visibleExercises(intakeAnswers).length : 0;
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

      {/* Week strip — training rhythm at a glance */}
      {currentProgram && sessionsPerLoop > 0 && (
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              This week
            </span>
            <span
              className={`text-xs font-semibold ${
                doneThisWeek >= sessionsPerLoop
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              {Math.min(doneThisWeek, sessionsPerLoop)} of {sessionsPerLoop} done
            </span>
          </div>
          <div className="flex justify-between">
            {weekDays.map((d) => {
              const done = datesWithSession.has(d.iso);
              return (
                <div key={d.iso} className="text-center">
                  <p
                    className={`text-[10px] mb-1 ${
                      d.isToday
                        ? "font-bold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {d.label}
                  </p>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      done
                        ? "bg-green-100"
                        : d.isToday
                          ? "border-2 border-accent"
                          : "border border-border"
                    }`}
                  >
                    {done ? (
                      <Check size={15} className="text-green-600" />
                    ) : d.isToday ? (
                      <span className="text-[11px] font-bold text-accent">
                        {totalSessionsCompleted + 1}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current program hero */}
      {currentProgram ? (
        <div className="bg-foreground text-background rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider opacity-70 font-semibold mb-1">
            Next session
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-1">
            {nextSessionLabel ?? currentProgram.title}
          </h2>
          {nextSession && (
            <p className="text-sm opacity-70 mb-4 flex items-center gap-3 flex-wrap">
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

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/app/today"
              className="inline-flex items-center gap-2 bg-accent text-white font-semibold rounded-full px-5 py-2.5 text-sm hover:opacity-95 transition"
            >
              Start Session {totalSessionsCompleted + 1}
              <ArrowRight size={16} />
            </Link>
            <Link
              to={`/app/programs/${currentProgram.slug}`}
              className="inline-flex items-center rounded-full border border-background/40 px-4 py-2.5 text-xs opacity-80 hover:opacity-100"
            >
              Preview
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-heading text-xl font-bold mb-2">No active program</h2>
          <p className="text-sm text-muted-foreground">
            Your coach hasn't assigned an active program yet. Check the catalogue below or get in touch.
          </p>
        </div>
      )}

      {/* Progress ring + streak */}
      {currentProgram && expectedTotal > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
            {(() => {
              const pct = Math.min(1, totalSessionsCompleted / expectedTotal);
              const C = 2 * Math.PI * 18;
              return (
                <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
                  <circle cx="26" cy="26" r="18" fill="none" stroke="currentColor" strokeWidth="5" className="text-border" />
                  <circle
                    cx="26" cy="26" r="18" fill="none"
                    stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                    className={isOverdue ? "text-red-400" : "text-accent"}
                    strokeDasharray={`${Math.round(pct * C)} ${Math.round(C)}`}
                    transform="rotate(-90 26 26)"
                  />
                  <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" className="text-foreground">
                    {totalSessionsCompleted}
                  </text>
                </svg>
              );
            })()}
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm">
                {totalSessionsCompleted} of {expectedTotal}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {isOverdue
                  ? `Ended ${Math.abs(daysLeft)}d ago`
                  : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
            <Flame
              size={26}
              className={streakWeeks > 0 ? "text-accent shrink-0" : "text-muted-foreground/40 shrink-0"}
            />
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm">
                {streakWeeks} week{streakWeeks === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-muted-foreground">Training streak</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatCard
          label="Reply from your coach"
          value={unreadComments.length}
          icon={<MessageCircle size={18} />}
          to="/app/inbox"
          highlight={unreadComments.length > 0}
        />
        <StatCard
          label="Archived programs"
          value={archivedCount}
          icon={<Archive size={18} />}
          to="/app/archived"
        />
      </div>

      {/* Program ending / overdue warning */}
      {currentProgram && (isOverdue || daysLeft <= 7) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              {isOverdue
                ? "Your program has ended. Time to check in with your coach"
                : `Your program ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`}
            </p>
            <p className="text-amber-800 mt-0.5">
              Drop a message in any exercise's comments and Maxime will pick it up.
            </p>
          </div>
        </div>
      )}

      {/* Recent coach messages */}
      {unreadComments.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-heading text-xl font-bold mb-3 flex items-center gap-2">
            <MessageCircle size={18} className="text-accent" />
            New from your coach
          </h2>
          <ul className="space-y-2">
            {unreadComments.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  to="/app/inbox#messages"
                  className="flex items-start gap-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-2 -mx-2"
                >
                  <Dumbbell size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {c.program_items?.custom_name
                        ?.replace(/^\[[^\]]+\]\s*/, "") ?? "Exercise"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.body}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatRelative(c.created_at, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  to,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
  highlight?: boolean;
}) => (
  <Link
    to={to}
    className={`block rounded-2xl border p-4 hover:shadow-md transition ${
      highlight && value > 0
        ? "bg-accent/10 border-accent/40"
        : "bg-white border-border"
    }`}
  >
    <div className={`${highlight && value > 0 ? "text-accent" : "text-muted-foreground"} mb-1`}>
      {icon}
    </div>
    <p className="font-heading text-3xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </Link>
);

function formatRelative(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
        <p className="text-xs uppercase tracking-wider font-semibold text-accent">{tag}</p>
        <h2 className="font-heading text-xl font-bold mt-0.5">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
      <ArrowRight size={20} className="text-accent shrink-0 mt-2" />
    </div>
  </Link>
);

export default ClientDashboard;
