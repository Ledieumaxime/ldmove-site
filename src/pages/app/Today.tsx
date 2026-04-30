import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Link2,
  Trophy,
} from "lucide-react";
import { sbGet, sbPatch } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ProgramItemCard, { ProgramItem } from "@/components/ProgramItemCard";
import {
  CompletedLog,
  ProgramWeekLite,
  WorkoutDay,
  countCompletedSessions,
  dayDisplayLabel,
  listProgramDays,
  nextDay,
} from "@/lib/workoutDay";
import { sectionStyle } from "@/lib/programSections";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_weeks: number | null;
  assigned_client_id: string | null;
  is_archived: boolean;
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const Today = () => {
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState<ProgramWeekLite[]>([]);
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [logs, setLogs] = useState<CompletedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When the client just finished a session in this page load, we keep
   *  the celebration view (locked tracker + green banner + Continue
   *  button) instead of jumping straight to the next session. The pin
   *  is the (weekId, session_date) tuple of the completed session.
   *  Cleared when the client clicks "Continue to next session" or
   *  navigates fresh. */
  const [celebrated, setCelebrated] = useState<{
    weekId: string;
    sessionDate: string;
  } | null>(null);

  const loadAll = async () => {
    if (!user) return;
    try {
      // Active custom program for this client (most recent non-archived published).
      const programs = await sbGet<Program[]>(
        `programs?select=id,slug,title,description,duration_weeks,assigned_client_id,is_archived` +
          `&type=eq.custom&assigned_client_id=eq.${user.id}` +
          `&is_archived=eq.false&is_published=eq.true` +
          `&order=created_at.desc&limit=1`
      );
      if (programs.length === 0) {
        setLoading(false);
        return;
      }
      const p = programs[0];
      setProgram(p);

      const w = await sbGet<ProgramWeekLite[]>(
        `program_weeks?select=id,week_number,title&program_id=eq.${p.id}&order=week_number.asc`
      );
      setWeeks(w);

      const weekIds = w.map((x) => x.id);
      const [it, lg] = await Promise.all([
        weekIds.length > 0
          ? sbGet<ProgramItem[]>(
              `program_items?select=id,week_id,order_index,custom_name,sets,reps,rest_seconds,notes,video_url,group_name` +
                `&week_id=in.(${weekIds.join(",")})` +
                `&order=order_index.asc`
            )
          : Promise.resolve([] as ProgramItem[]),
        sbGet<CompletedLog[]>(
          `workout_logs?select=program_item_id,session_date,completed_at` +
            `&client_id=eq.${user.id}` +
            `&completed_at=not.is.null`
        ),
      ]);

      setItems(it);
      setLogs(lg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const days: WorkoutDay[] = useMemo(
    () => listProgramDays(weeks, items),
    [weeks, items]
  );
  const today = useMemo(() => todayISO(), []);

  // Total sessions completed across all loops (sequential count).
  const totalCompleted = useMemo(
    () => countCompletedSessions(days, logs),
    [days, logs]
  );

  // The session to display: either the just-completed one (celebration) or
  // the one ranked totalCompleted+1 in sequence.
  const todaysWorkout: WorkoutDay | null = useMemo(() => {
    if (celebrated) {
      return days.find((d) => d.weekId === celebrated.weekId) ?? null;
    }
    return nextDay(days, logs);
  }, [celebrated, days, logs]);

  // Sequential session number for display ("Session 1", "Session 16", etc.).
  // While celebrating: it's totalCompleted (the one just done).
  // While doing a fresh session: totalCompleted + 1.
  const displaySessionNumber = celebrated
    ? totalCompleted
    : totalCompleted + 1;

  /** UUID identifying the current run of the displayed session.
   *  - If we're in celebration mode: take the run id of the most recent
   *    completed log on this session's items (the one we just stamped).
   *  - Otherwise: reuse any existing in-progress run (logs without
   *    completed_at on this session's items). If none exists yet, mint
   *    a fresh UUID — it will be persisted on the first set save.
   *  The ref makes sure the freshly-minted UUID is stable across re-renders.
   */
  const freshRunIdRef = useRef<string | null>(null);
  const sessionRunId = useMemo(() => {
    if (!todaysWorkout) return "00000000-0000-0000-0000-000000000000";
    const sessionItemIds = new Set(todaysWorkout.items.map((i) => i.id));

    if (celebrated) {
      // Find the most recent completed_at on this session's items.
      let latest: CompletedLog | null = null;
      for (const log of logs) {
        if (!log.completed_at) continue;
        if (!sessionItemIds.has(log.program_item_id)) continue;
        if (!latest || log.completed_at > (latest.completed_at ?? "")) {
          latest = log;
        }
      }
      if (latest) return latest.session_run_id;
    }

    // In-progress run? (a log without completed_at on this session's items)
    const inProgress = logs.find(
      (l) => !l.completed_at && sessionItemIds.has(l.program_item_id)
    );
    if (inProgress) {
      freshRunIdRef.current = null;
      return inProgress.session_run_id;
    }

    if (!freshRunIdRef.current) {
      freshRunIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return freshRunIdRef.current;
  }, [todaysWorkout, logs, celebrated]);

  // Logger should be locked when we're in the celebration view.
  const justCompletedToday = celebrated != null;

  const completeWorkout = async () => {
    if (!todaysWorkout || !user) return;
    setCompleting(true);
    setError(null);
    try {
      // Stamp every log of the current run as completed.
      await sbPatch(
        `workout_logs?client_id=eq.${user.id}` +
          `&session_run_id=eq.${sessionRunId}` +
          `&completed_at=is.null`,
        { completed_at: new Date().toISOString() }
      );
      // Stay on the just-completed session for the celebration view.
      setCelebrated({ weekId: todaysWorkout.weekId, sessionDate: today });
      // Reset the freshly-minted run id so the next session gets its own.
      freshRunIdRef.current = null;
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompleting(false);
    }
  };

  const continueToNext = () => {
    setCelebrated(null);
    // Scroll back to top so the client lands on the new session header.
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // No active 1:1 program assigned.
  if (!program) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <Lock className="mx-auto text-muted-foreground" size={28} />
        <h1 className="font-heading text-2xl font-bold">No active program</h1>
        <p className="text-sm text-muted-foreground">
          You don't have a 1:1 program assigned yet. Your coach will set one up
          for you soon.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/home">Back to my space</Link>
        </Button>
      </div>
    );
  }

  // No session at all (program has no weeks/items yet).
  if (!todaysWorkout) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <Lock className="mx-auto text-muted-foreground" size={28} />
        <h1 className="font-heading text-2xl font-bold">No session yet</h1>
        <p className="text-sm text-muted-foreground">
          Your block <strong>{program.title}</strong> doesn't have any session
          published yet. Your coach is on it.
        </p>
      </div>
    );
  }

  // Group today's items by [SECTION] prefix to keep the warmup/exercise/etc. structure.
  type SectionGroup = { section: string; items: ProgramItem[] };
  const sections: SectionGroup[] = [];
  for (const it of todaysWorkout.items) {
    const match = it.custom_name?.match(/^\[([^\]]+)\]\s*(.*)$/);
    const section = match ? match[1].trim().toUpperCase() : "EXERCISES";
    const last = sections[sections.length - 1];
    if (last && last.section === section) last.items.push(it);
    else sections.push({ section, items: [it] });
  }

  const totalDays = days.length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">
          {celebrated ? "Just finished" : "Today's workout"}
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1">
          Session {displaySessionNumber}
        </h1>
        <p className="text-sm text-muted-foreground">
          {program.title} · {dayDisplayLabel(todaysWorkout)}
        </p>
      </div>

      {celebrated && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="text-green-700 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-green-900">
                Session {displaySessionNumber} complete. Great work.
              </p>
              <p className="text-green-800 mt-0.5">
                Your numbers are saved. Move on to Session{" "}
                {displaySessionNumber + 1} when you're ready.
              </p>
            </div>
          </div>
          <Button onClick={continueToNext} className="gap-2">
            Continue to Session {displaySessionNumber + 1}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {sections.map((sec, sIdx) => {
        const style = sectionStyle(sec.section);
        // Build blocks within the section: solo items vs supersets
        // (consecutive items sharing the same group_name).
        type Block =
          | { type: "solo"; item: ProgramItem }
          | { type: "group"; name: string; items: ProgramItem[] };
        const blocks: Block[] = [];
        for (const it of sec.items) {
          if (it.group_name) {
            const last = blocks[blocks.length - 1];
            if (last && last.type === "group" && last.name === it.group_name) {
              last.items.push(it);
            } else {
              blocks.push({
                type: "group",
                name: it.group_name,
                items: [it],
              });
            }
          } else {
            blocks.push({ type: "solo", item: it });
          }
        }

        return (
          <section key={sIdx} className="space-y-3">
            <div
              className={`inline-block text-sm md:text-base font-bold uppercase tracking-widest px-4 py-2 rounded-lg shadow-sm ${style.badge}`}
            >
              {sec.section}
            </div>
            <div className="space-y-2.5">
              {blocks.map((b, bIdx) => {
                if (b.type === "solo") {
                  return (
                    <ProgramItemCard
                      key={b.item.id}
                      item={b.item}
                      canComment
                      accent={style.border}
                      loggerClientId={user?.id ?? null}
                      loggerReadOnly={justCompletedToday}
                      sessionRunId={sessionRunId}
                    />
                  );
                }
                const groupSets =
                  b.items.find((it) => it.sets != null)?.sets ?? null;
                const groupRest =
                  [...b.items]
                    .reverse()
                    .find(
                      (it) => it.rest_seconds != null && it.rest_seconds > 0
                    )?.rest_seconds ?? null;
                return (
                  <div
                    key={`g-${bIdx}`}
                    className={`rounded-xl p-3 ${style.groupBox}`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${style.groupBadge}`}
                      >
                        <Link2 size={11} /> {b.name}
                      </span>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        {groupSets != null && (
                          <span className="text-foreground">
                            {groupSets} rounds
                          </span>
                        )}
                        {groupRest != null && (
                          <span className="text-muted-foreground">
                            {groupRest}s rest between rounds
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic mb-2">
                      Chain exercises with no rest, then rest after the last one.
                    </p>
                    <div className="space-y-2">
                      {b.items.map((it, i) => (
                        <div key={it.id} className="relative pl-7">
                          <span
                            className={`absolute left-0 top-2 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${style.groupBullet}`}
                          >
                            {i + 1}
                          </span>
                          <ProgramItemCard
                            item={it}
                            compact
                            inSuperset
                            canComment
                            loggerClientId={user?.id ?? null}
                            loggerReadOnly={justCompletedToday}
                            setsOverride={groupSets}
                            sessionRunId={sessionRunId}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!celebrated && (
        <div className="sticky bottom-4 z-10 bg-white border border-border rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <p className="font-semibold">Done with this session?</p>
            <p className="text-muted-foreground text-xs">
              Mark it complete to lock your numbers and unlock the next one.
            </p>
          </div>
          <Button
            onClick={completeWorkout}
            disabled={completing}
            className="gap-2"
          >
            {completing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trophy size={16} />
            )}
            {completing ? "Saving…" : "Complete workout"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalCompleted} workout{totalCompleted !== 1 ? "s" : ""} done · block has {totalDays} session{totalDays !== 1 ? "s" : ""} per loop
        </span>
        <Link
          to={`/app/programs/${program.slug}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          View full program <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
};

export default Today;
