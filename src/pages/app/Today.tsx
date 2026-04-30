import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  PartyPopper,
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
  dayDisplayLabel,
  listProgramDays,
  nextDay,
} from "@/lib/workoutDay";

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
          `workout_logs?select=program_item_id,completed_at` +
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
  const todaysWorkout = useMemo(() => nextDay(days, logs), [days, logs]);
  const completedDays = useMemo(
    () => days.filter((d) => logs.some((l) => l.completed_at != null && d.items.some((i) => i.id === l.program_item_id))).length,
    [days, logs]
  );

  // Did the client already complete today's session today?
  const justCompletedToday = useMemo(() => {
    if (!todaysWorkout) return false;
    const today = todayISO();
    return logs.some(
      (l) =>
        l.completed_at != null &&
        l.completed_at.startsWith(today) &&
        todaysWorkout.items.some((i) => i.id === l.program_item_id)
    );
  }, [todaysWorkout, logs]);

  const completeWorkout = async () => {
    if (!todaysWorkout || !user) return;
    setCompleting(true);
    setError(null);
    try {
      const today = todayISO();
      const itemIds = todaysWorkout.items.map((i) => i.id);
      // Only stamp rows that were actually logged today.
      const inList = `(${itemIds.join(",")})`;
      await sbPatch(
        `workout_logs?client_id=eq.${user.id}` +
          `&program_item_id=in.${inList}` +
          `&session_date=eq.${today}` +
          `&completed_at=is.null`,
        { completed_at: new Date().toISOString() }
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
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

  // All days completed: program done.
  if (!todaysWorkout) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <PartyPopper className="mx-auto text-amber-600" size={28} />
        <h1 className="font-heading text-2xl font-bold">Program complete</h1>
        <p className="text-sm text-muted-foreground">
          You finished every day of <strong>{program.title}</strong>. Talk to
          your coach for the next bloc.
        </p>
        <Button asChild variant="outline">
          <Link to={`/app/programs/${program.slug}`}>Review the program</Link>
        </Button>
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
  const dayIndex =
    days.findIndex(
      (d) =>
        d.weekId === todaysWorkout.weekId &&
        d.dayLabel === todaysWorkout.dayLabel
    ) + 1;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">
          Today's workout
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1">
          {dayDisplayLabel(todaysWorkout)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {program.title} · day {dayIndex} of {totalDays}
        </p>
      </div>

      {justCompletedToday && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-green-700 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-green-900">
              Workout complete. Great session.
            </p>
            <p className="text-green-800 mt-0.5">
              Your coach can see your reps and weights. Come back tomorrow for
              the next day.
            </p>
          </div>
        </div>
      )}

      {sections.map((sec, sIdx) => (
        <section key={sIdx} className="space-y-3">
          <p className="inline-block text-xs font-bold uppercase tracking-widest bg-muted text-foreground rounded-md px-3 py-1.5">
            {sec.section}
          </p>
          <div className="space-y-2.5">
            {sec.items.map((it) => (
              <ProgramItemCard
                key={it.id}
                item={it}
                canComment
                loggerClientId={user?.id ?? null}
                loggerReadOnly={justCompletedToday}
              />
            ))}
          </div>
        </section>
      ))}

      {!justCompletedToday && (
        <div className="sticky bottom-4 z-10 bg-white border border-border rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <p className="font-semibold">Done with today's session?</p>
            <p className="text-muted-foreground text-xs">
              Mark it complete to lock your numbers and unlock tomorrow's day.
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
        <span>{completedDays} / {totalDays} days completed</span>
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
