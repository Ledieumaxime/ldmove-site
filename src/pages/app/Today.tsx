import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Link2,
  SkipForward,
  Trophy,
} from "lucide-react";
import { sbGet, sbPatch, sbPost } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ProgramItemCard, { ProgramItem } from "@/components/ProgramItemCard";
import BackToDashboard from "@/components/BackToDashboard";
import {
  CompletedLog,
  ProgramWeekLite,
  WorkoutDay,
  clearChosenWeek,
  countCompletedSessions,
  dayDisplayLabel,
  getChosenWeek,
  listProgramDays,
  nextDay,
} from "@/lib/workoutDay";
import {
  blockAccent,
  blockStatsLabel,
  groupTypeLabel,
} from "@/lib/programSections";

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
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState<ProgramWeekLite[]>([]);
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [logs, setLogs] = useState<CompletedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // One embedded request replaces the old weeks → items → logs
      // waterfall (3 serial round trips, the logs one chunked): every
      // week with its items (+ exercise description), every item with
      // this client's logs. Only the top level is subject to the
      // server's ~1000-row cap and that's just the program_weeks rows;
      // scoping logs to this program's items (instead of a bare
      // client_id filter) keeps long-time clients from hitting the cap
      // and corrupting the completed-session count.
      type WeekEmbed = ProgramWeekLite & {
        program_items:
          | Array<
              ProgramItem & {
                exercise: { description: string | null } | null;
                workout_logs: CompletedLog[] | null;
              }
            >
          | null;
      };
      const w = await sbGet<WeekEmbed[]>(
        `program_weeks?select=id,week_number,title,` +
          `program_items(id,week_id,order_index,custom_name,sets,reps,rest_seconds,notes,video_url,group_name,exercise:exercises(description),` +
          `workout_logs(program_item_id,session_run_id,session_date,completed_at))` +
          `&program_id=eq.${p.id}&order=week_number.asc` +
          `&program_items.order=order_index.asc` +
          `&program_items.workout_logs.client_id=eq.${user.id}`
      );
      setWeeks(w.map(({ program_items: _pi, ...week }) => week));

      const it: ProgramItem[] = [];
      const lg: CompletedLog[] = [];
      for (const week of w) {
        for (const raw of week.program_items ?? []) {
          const { exercise, workout_logs, ...rest } = raw;
          it.push({ ...rest, description: exercise?.description ?? null });
          if (workout_logs) lg.push(...workout_logs);
        }
      }

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

  const days: WorkoutDay<ProgramItem>[] = useMemo(
    () => listProgramDays(weeks, items),
    [weeks, items]
  );
  const today = useMemo(() => todayISO(), []);

  // Total sessions completed across all loops (sequential count).
  const totalCompleted = useMemo(
    () => countCompletedSessions(days, logs),
    [days, logs]
  );

  // The session picked with "Skip session" on the dashboard, read from
  // sessionStorage so this page opens what the client actually chose.
  const chosenWeek = program ? getChosenWeek(program.id) : null;

  const todaysWorkout: WorkoutDay<ProgramItem> | null = useMemo(
    () => nextDay(days, logs, chosenWeek),
    [days, logs, chosenWeek]
  );

  // Sequential session number for display ("Session 1", "Session 16", etc.).
  const displaySessionNumber = totalCompleted + 1;

  /** UUID identifying the current run of the displayed session.
   *  Reuse any existing in-progress run (logs without completed_at on
   *  this session's items). If none exists, mint a fresh UUID stable
   *  across renders via a ref — it gets persisted on the first set save.
   */
  const freshRunIdRef = useRef<string | null>(null);
  const sessionRunId = useMemo(() => {
    if (!todaysWorkout) return "00000000-0000-0000-0000-000000000000";
    const sessionItemIds = new Set(todaysWorkout.items.map((i) => i.id));

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
  }, [todaysWorkout, logs]);

  const completeWorkout = async () => {
    if (!todaysWorkout || !user) return;
    setCompleting(true);
    setError(null);
    try {
      const stamp = new Date().toISOString();
      // Stamp every log of the current run as completed. The PATCH is
      // authoritative (server-side): it catches logs created by the
      // WorkoutLogger children even though this page's local `logs`
      // state is a snapshot from mount.
      const stamped = await sbPatch<unknown[]>(
        `workout_logs?client_id=eq.${user.id}` +
          `&session_run_id=eq.${sessionRunId}` +
          `&completed_at=is.null`,
        { completed_at: stamp }
      );
      if (!Array.isArray(stamped) || stamped.length === 0) {
        // Zero rows stamped → the client didn't tick a single set
        // (they followed the session without logging). The PATCH-only
        // path used to be a silent no-op here, so the session never
        // counted as done and the client kept seeing the same one.
        // Write a completion marker so the run registers. Upsert so a
        // race with a just-created log can't 409.
        await sbPost(
          "workout_logs?on_conflict=client_id,program_item_id,session_run_id,set_number",
          {
            client_id: user.id,
            program_item_id: todaysWorkout.items[0].id,
            session_run_id: sessionRunId,
            session_date: today,
            set_number: 1,
            reps_done: null,
            weight_kg: null,
            completed_at: stamp,
          },
          { merge: true }
        );
      }
      // Reset the freshly-minted run id so the next session gets its own.
      freshRunIdRef.current = null;
      // The loop moved on, so anything pushed back earlier is pending
      // again on its own merits rather than still being stepped over.
      clearChosenWeek(program.id);
      // Send the client back to the dashboard, where the next session
      // shows up as the new "Start Session N" CTA.
      navigate("/app/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCompleting(false);
    }
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

  // Today's session exists in the program structure but has no
  // exercises filled in yet. Surface it explicitly instead of
  // silently jumping the loop to a different session (which is what
  // happened before — the empty week was skipped entirely, the
  // modulo wrapped early and the client saw the wrong session).
  if (todaysWorkout.isEmpty) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <Lock className="mx-auto text-muted-foreground" size={28} />
        <h1 className="font-heading text-2xl font-bold">
          {dayDisplayLabel(todaysWorkout)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your coach hasn't filled this session yet. Check back soon or ping
          them — once the exercises are in, this page updates automatically.
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
      <BackToDashboard />
      {/* A masthead: the two rules under the dateline are what make a
          page read as a front page rather than a form. */}
      <div>
        <div className="flex items-baseline justify-between gap-3 pb-2 border-b-2 border-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Today's workout
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/50 truncate">
            {program.title} · {dayDisplayLabel(todaysWorkout)}
          </span>
        </div>
        <div className="border-b border-foreground/30 mt-[3px]" />
        <h1 className="font-heading text-[38px] leading-[1.05] font-bold tracking-[-0.02em] mt-5">
          Session {displaySessionNumber}
        </h1>
        {chosenWeek && (
          <p className="text-xs text-muted-foreground mt-2">
            You picked this session for today. What you skipped is still
            owed before this block loops.
          </p>
        )}
      </div>

      {sections.map((sec, sIdx) => {
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

        const sectionCount = sec.items.length;

        return (
          <section key={sIdx}>
            {/* Section rule rather than a coloured badge: the section is
                where you are in the session, not a thing to shout. */}
            <div className="flex items-baseline justify-between pb-2 mb-5 border-b border-foreground/20">
              <b className="font-heading text-[13px] font-semibold uppercase tracking-[0.18em]">
                {sec.section}
              </b>
              <span className="text-[12.5px] text-foreground/45">
                {sectionCount} exercise{sectionCount === 1 ? "" : "s"}
              </span>
            </div>

            {blocks.map((b, bIdx) => {
              const isGroup = b.type === "group";
              const groupName = isGroup ? b.name : null;
              const accent = blockAccent(sec.section, groupName);
              const groupSets = isGroup
                ? b.items.find((it) => it.sets != null)?.sets ?? null
                : b.item.sets;
              const groupRest = isGroup
                ? [...b.items]
                    .reverse()
                    .find((it) => it.rest_seconds != null && it.rest_seconds > 0)
                    ?.rest_seconds ?? null
                : b.item.rest_seconds;
              const kind = isGroup ? groupTypeLabel(groupName) : "Set";
              const stats = blockStatsLabel(groupName, groupSets, groupRest);
              const items = isGroup ? b.items : [b.item];

              return (
                <div key={`b-${bIdx}`} className={bIdx === 0 ? "" : "mt-7"}>
                  {/* A 3px tick and the kind in small caps, instead of the
                      full-width colour banner that used to open every
                      block and outshout the exercises inside it. */}
                  <div className="flex items-center gap-[9px] flex-wrap">
                    {/* The block's place in the session. Numbering only the
                        exercises inside a group left a client unable to tell
                        how far through the session they were. */}
                    <span
                      className="w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                      style={{ background: accent.tick }}
                    >
                      {bIdx + 1}
                    </span>
                    <span
                      aria-hidden
                      className="w-[3px] h-[13px] shrink-0"
                      style={{ background: accent.tick }}
                    />
                    <span
                      className="text-[11.5px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: accent.label }}
                    >
                      {kind}
                    </span>
                    {stats && (
                      <span className="text-[12.5px] text-foreground/45">
                        {stats}
                      </span>
                    )}
                  </div>

                  {accent.note && (
                    <p className="italic text-[13.5px] leading-[1.5] text-foreground/55 mt-2 pl-3">
                      {accent.note}
                    </p>
                  )}

                  {/* The rule down the left is what says "these are done
                      as one thing", and where it stops says where the
                      chain ends. Solo blocks get no rule. */}
                  <div
                    className="pl-3 mt-0.5"
                    style={{
                      borderLeft: `2px solid ${
                        accent.chained ? accent.chain : "transparent"
                      }`,
                      opacity: 1,
                    }}
                  >
                    {items.map((it, i) => (
                      <div
                        key={it.id}
                        className="flex items-start gap-3 py-5 border-b border-foreground/10"
                      >
                        <span className="font-heading text-[13px] font-semibold text-foreground/40 w-4 shrink-0 pt-1">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <ProgramItemCard
                            item={it}
                            compact={isGroup}
                            inSuperset={isGroup}
                            canComment
                            canUploadFormCheck
                            loggerClientId={user?.id ?? null}
                            loggerReadOnly={false}
                            setsOverride={isGroup ? groupSets : undefined}
                            sessionRunId={sessionRunId}
                            flush
                            noPadding
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {/* One full-width action, on a fade rather than in a floating card:
          the content slides under it instead of stopping at its edge. */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 pt-6 pb-6 bg-gradient-to-t from-white from-60% to-transparent">
        <Button
          onClick={completeWorkout}
          disabled={completing}
          className="w-full h-[50px] rounded-full gap-2 bg-foreground text-white hover:bg-foreground/90 text-base font-semibold"
        >
          {completing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trophy size={16} />
          )}
          {completing ? "Saving…" : "Complete workout"}
        </Button>
        <p className="text-center text-[12.5px] text-foreground/45 mt-2">
          Locks your numbers and unlocks the next session.
        </p>
      </div>

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
