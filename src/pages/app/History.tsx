import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  History as HistoryIcon,
  Loader2,
  Trophy,
} from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { detectTracking, stripSection } from "@/components/ProgramItemCard";

/**
 * Past workout sessions for the client. One card per completed
 * session_run_id. Default collapsed; click to expand and see the
 * sets logged per exercise. Useful to see progression over time
 * without diving into the full logger UI.
 */

type LogRow = {
  id: string;
  program_item_id: string;
  session_run_id: string;
  session_date: string;
  set_number: number;
  reps_done: number | null;
  weight_kg: number | null;
  completed_at: string;
  program_items: {
    id: string;
    custom_name: string | null;
    sets: number | null;
    reps: string | null;
    rest_seconds: number | null;
    notes: string | null;
    video_url: string | null;
    group_name: string | null;
    week_id: string;
    order_index: number;
    program_weeks: {
      title: string | null;
      week_number: number;
      program_id: string;
      programs: {
        title: string;
        slug: string;
        is_archived: boolean;
      } | null;
    } | null;
  } | null;
};

type ExerciseGroup = {
  itemId: string;
  name: string;
  unitLabel: string;
  sets: LogRow[];
  prescribedReps: string | null;
};

type SessionGroup = {
  runId: string;
  completedAt: string;
  programTitle: string;
  programSlug: string;
  programArchived: boolean;
  weekTitle: string | null;
  weekNumber: number;
  exercises: ExerciseGroup[];
};

const formatLongDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const sessionLabel = (g: SessionGroup) =>
  g.weekTitle?.trim() ? g.weekTitle.trim() : `Session ${g.weekNumber}`;

const History = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // 3-level embed: log → program_item → program_week → program.
        // PostgREST uses parens for nested selects.
        const rows = await sbGet<LogRow[]>(
          `workout_logs?` +
            `select=id,program_item_id,session_run_id,session_date,set_number,reps_done,weight_kg,completed_at,` +
            `program_items(id,custom_name,sets,reps,rest_seconds,notes,video_url,group_name,week_id,order_index,` +
            `program_weeks(title,week_number,program_id,programs(title,slug,is_archived)))` +
            `&client_id=eq.${user.id}` +
            `&completed_at=not.is.null` +
            `&order=completed_at.desc,set_number.asc`
        );
        setLogs(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const sessions: SessionGroup[] = useMemo(() => {
    const byRun = new Map<string, LogRow[]>();
    for (const log of logs) {
      if (!log.program_items?.program_weeks) continue;
      if (!byRun.has(log.session_run_id)) byRun.set(log.session_run_id, []);
      byRun.get(log.session_run_id)!.push(log);
    }

    const groups: SessionGroup[] = [];
    for (const [runId, runLogs] of byRun) {
      // newest completed_at within the run wins (they're stamped together
      // anyway, but be defensive in case of partial completes).
      const completedAt = runLogs.reduce(
        (acc, l) => (l.completed_at > acc ? l.completed_at : acc),
        runLogs[0].completed_at
      );

      const week = runLogs[0].program_items!.program_weeks!;
      const program = week.programs;

      // Group logs by program_item_id, ordered by item.order_index.
      const byItem = new Map<string, LogRow[]>();
      for (const l of runLogs) {
        if (!byItem.has(l.program_item_id)) byItem.set(l.program_item_id, []);
        byItem.get(l.program_item_id)!.push(l);
      }
      const exercises: ExerciseGroup[] = [];
      for (const [itemId, itemLogs] of byItem) {
        const item = itemLogs[0].program_items!;
        const tracking = detectTracking({
          id: item.id,
          week_id: item.week_id,
          order_index: item.order_index,
          custom_name: item.custom_name,
          sets: item.sets,
          reps: item.reps,
          rest_seconds: item.rest_seconds,
          notes: item.notes,
          video_url: item.video_url,
          group_name: item.group_name,
        });
        // Skip "no tracking" sections (warmups, mobility) — they don't
        // produce meaningful logs anyway.
        if (tracking.mode === "none") continue;
        exercises.push({
          itemId,
          name: stripSection(item.custom_name),
          unitLabel: tracking.unitLabel,
          sets: [...itemLogs].sort((a, b) => a.set_number - b.set_number),
          prescribedReps: item.reps,
        });
      }
      // Order exercises by their position in the program.
      exercises.sort((a, b) => {
        const ai = runLogs.find((l) => l.program_item_id === a.itemId)
          ?.program_items?.order_index ?? 0;
        const bi = runLogs.find((l) => l.program_item_id === b.itemId)
          ?.program_items?.order_index ?? 0;
        return ai - bi;
      });

      groups.push({
        runId,
        completedAt,
        programTitle: program?.title ?? "Program",
        programSlug: program?.slug ?? "",
        programArchived: program?.is_archived ?? false,
        weekTitle: week.title,
        weekNumber: week.week_number,
        exercises,
      });
    }

    return groups.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }, [logs]);

  const toggle = (runId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
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

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold flex items-center gap-2">
          <HistoryIcon size={26} /> Training history
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every workout you've completed, most recent first. Tap a session
          to see the numbers you logged.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-8 text-center space-y-2">
          <Trophy className="mx-auto text-muted-foreground" size={28} />
          <h2 className="font-heading text-xl font-bold">No sessions yet</h2>
          <p className="text-sm text-muted-foreground">
            Once you finish your first workout it'll show up here. Build the
            log, watch yourself progress.
          </p>
          <Link
            to="/app/today"
            className="inline-flex items-center gap-2 mt-3 bg-accent text-white font-semibold rounded-full px-4 py-2 text-sm hover:opacity-95 transition"
          >
            Go to today's workout
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} done
          </p>
          {sessions.map((s) => {
            const isOpen = expanded.has(s.runId);
            return (
              <div
                key={s.runId}
                className="bg-white border border-border rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(s.runId)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <CalendarDays size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-base leading-tight">
                      {sessionLabel(s)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {s.programTitle}
                      {s.programArchived ? " · archived block" : ""} ·{" "}
                      {formatLongDate(s.completedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {s.exercises.length} exercise
                      {s.exercises.length !== 1 ? "s" : ""}
                    </span>
                    {isOpen ? (
                      <ChevronUp size={18} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={18} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 space-y-2 bg-muted/20">
                    {s.exercises.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No tracked exercises in this session.
                      </p>
                    ) : (
                      s.exercises.map((ex) => (
                        <ExerciseRow key={ex.itemId} ex={ex} />
                      ))
                    )}
                    {s.programSlug && (
                      <Link
                        to={`/app/programs/${s.programSlug}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
                      >
                        View full program
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ExerciseRow = ({ ex }: { ex: ExerciseGroup }) => {
  const numbers = ex.sets
    .map((s) => (s.reps_done != null ? String(s.reps_done) : "—"))
    .join(", ");
  const weights = ex.sets
    .map((s) => s.weight_kg)
    .filter((w): w is number => w != null);
  const maxWeight = weights.length > 0 ? Math.max(...weights) : null;

  return (
    <div className="bg-white border border-border rounded-lg p-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="font-semibold text-sm">{ex.name}</p>
        {ex.prescribedReps && (
          <p className="text-[11px] text-muted-foreground">
            target: {ex.prescribedReps}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        <span className="font-semibold text-foreground">{numbers}</span>{" "}
        {ex.unitLabel}
        {maxWeight != null && (
          <span className="ml-2">· up to {maxWeight} kg</span>
        )}
      </p>
    </div>
  );
};

export default History;
