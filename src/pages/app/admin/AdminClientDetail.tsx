import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Edit2,
  History as HistoryIcon,
  Loader2,
  MessageCircle,
  PlusCircle,
  Video,
  ArrowRight,
  Send,
} from "lucide-react";
import { sbGet, sbPatch } from "@/integrations/supabase/api";
import {
  CompletedLog,
  countCompletedSessions,
  listProgramDays,
  ProgramWeekLite,
} from "@/lib/workoutDay";
import { detectTracking, stripSection } from "@/components/ProgramItemCard";

/**
 * Coach's per-client workspace. Combines everything the coach needs
 * to act on a single client without bouncing between pages:
 *  - status header + quick stats
 *  - current block (progress, recent sessions, edit / build-next CTAs)
 *  - activity timeline (form checks, comments, completions, in one
 *    chronological view)
 *  - sidebar inbox of stuff that needs a reply
 *  - intake summary + past blocks
 */

type Client = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_weeks: number | null;
  assigned_client_id: string | null;
  is_archived: boolean;
  is_published: boolean;
  created_at: string;
};

type IntakeRow = {
  client_id: string;
  main_goal: string | null;
  specific_skills: string[] | null;
  max_pull_ups: string | null;
  max_dips: string | null;
  max_push_ups: string | null;
  deep_squat: string | null;
  handstand: string | null;
  muscle_up: string | null;
  splits: string[] | null;
  shoulder_mobility: string | null;
  submitted_at: string | null;
  updated_at: string | null;
};

type FormCheck = {
  id: string;
  status: "pending" | "reviewed";
  created_at: string;
  client_id: string;
  item_id: string | null;
  program_items?: { custom_name: string | null } | null;
};

type Comment = {
  id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  item_id: string;
  program_items?: { custom_name: string | null } | null;
};

type LogRow = {
  id: string;
  program_item_id: string;
  session_run_id: string;
  session_date: string;
  set_number: number;
  reps_done: number | null;
  weight_kg: number | null;
  completed_at: string | null;
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
    } | null;
  } | null;
};

type ClientStatus = "ghosting" | "overdue" | "ending" | "behind" | "ontrack";

const STATUS_LABEL: Record<ClientStatus, string> = {
  ghosting: "Ghosting",
  overdue: "Block expired",
  behind: "Behind",
  ending: "Block ending",
  ontrack: "On track",
};

const STATUS_BADGE_CLASS: Record<ClientStatus, string> = {
  ghosting: "bg-red-600 text-white",
  overdue: "bg-red-600 text-white",
  behind: "bg-amber-500 text-white",
  ending: "bg-amber-500 text-white",
  ontrack: "bg-green-600 text-white",
};

const STATUS_BAR_CLASS: Record<ClientStatus, string> = {
  ghosting: "bg-red-400",
  overdue: "bg-red-400",
  behind: "bg-amber-400",
  ending: "bg-amber-400",
  ontrack: "bg-green-400",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatRelative = (iso: string, now: number) => {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
};

const AdminClientDetail = () => {
  const { id: clientId } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [intake, setIntake] = useState<IntakeRow | null>(null);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [weeks, setWeeks] = useState<
    Array<ProgramWeekLite & { program_id: string }>
  >([]);
  const [items, setItems] = useState<
    Array<{ id: string; week_id: string; order_index: number }>
  >([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      sbGet<Client[]>(
        `profiles?select=id,email,first_name,last_name,created_at&id=eq.${clientId}&limit=1`
      ),
      sbGet<Program[]>(
        `programs?select=*&type=eq.custom&assigned_client_id=eq.${clientId}&order=created_at.desc`
      ),
      sbGet<IntakeRow[]>(
        `client_intakes?select=client_id,main_goal,specific_skills,max_pull_ups,max_dips,max_push_ups,deep_squat,handstand,muscle_up,splits,shoulder_mobility,submitted_at,updated_at&client_id=eq.${clientId}&limit=1`
      ),
      sbGet<FormCheck[]>(
        `form_check_submissions?select=*,program_items(custom_name)&client_id=eq.${clientId}&order=created_at.desc&limit=50`
      ),
      sbGet<Comment[]>(
        `exercise_comments?select=*,program_items(custom_name)&order=created_at.desc&limit=200`
      ),
      sbGet<Array<ProgramWeekLite & { program_id: string }>>(
        `program_weeks?select=id,week_number,title,program_id`
      ),
      sbGet<Array<{ id: string; week_id: string; order_index: number }>>(
        `program_items?select=id,week_id,order_index`
      ),
      sbGet<LogRow[]>(
        `workout_logs?select=id,program_item_id,session_run_id,session_date,set_number,reps_done,weight_kg,completed_at,program_items(id,custom_name,sets,reps,rest_seconds,notes,video_url,group_name,week_id,order_index,program_weeks(title,week_number,program_id))&client_id=eq.${clientId}&order=completed_at.desc.nullslast,set_number.asc&limit=500`
      ),
    ])
      .then(([cl, p, i, f, co, w, it, lg]) => {
        if (cl.length === 0) {
          setError("Client not found");
          return;
        }
        setClient(cl[0]);
        setPrograms(p);
        setIntake(i[0] ?? null);
        setChecks(f);
        // Filter comments to threads where the latest item involves this
        // client. Cheaper: filter on program_items belonging to this
        // client's programs. Simpler: just keep comments where author
        // is this client (we still want to show coach replies separately
        // in the timeline though).
        const programIds = new Set(p.map((x) => x.id));
        const programItemIds = new Set<string>();
        // Will refine this below in useMemo using items + weeks data.
        setComments(co);
        setWeeks(w.filter((x) => programIds.has(x.program_id)));
        const weekIds = new Set(w.filter((x) => programIds.has(x.program_id)).map((x) => x.id));
        const filteredItems = it.filter((x) => weekIds.has(x.week_id));
        for (const i of filteredItems) programItemIds.add(i.id);
        setItems(filteredItems);
        setLogs(lg);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [clientId, reloadTick]);

  // Auto-refresh when the tab regains focus — same reasoning as the
  // dashboard: avoids a stale workout count after the coach checks
  // something on the client side.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setReloadTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const now = Date.now();

  const currentProgram = useMemo(
    () => programs.find((p) => !p.is_archived && p.is_published) ?? null,
    [programs]
  );

  // Build derived block data for the active program.
  const block = useMemo(() => {
    if (!currentProgram)
      return null as null | {
        status: ClientStatus;
        progress: number;
        daysLeft: number;
        sessionsDone: number;
        expectedTotal: number;
        workoutsBehind: number;
        daysSinceLastTraining: number | null;
        sessionsPerLoop: number;
      };
    const start = new Date(currentProgram.created_at).getTime();
    const wks = currentProgram.duration_weeks ?? 4;
    const end = start + wks * 7 * 86_400_000;
    const daysLeft = Math.ceil((end - now) / 86_400_000);

    const programWeeks = weeks
      .filter((w) => w.program_id === currentProgram.id)
      .map((w) => ({
        id: w.id,
        week_number: w.week_number,
        title: w.title,
      }));
    const programItemList = items.filter((i) =>
      programWeeks.some((w) => w.id === i.week_id)
    );
    const days = listProgramDays(programWeeks, programItemList);
    const completed: CompletedLog[] = logs
      .filter((l) => l.completed_at)
      .map((l) => ({
        program_item_id: l.program_item_id,
        session_run_id: l.session_run_id,
        session_date: l.session_date,
        completed_at: l.completed_at,
      }));
    const sessionsDone = countCompletedSessions(days, completed);
    const sessionsPerLoop = days.length;
    const expectedTotal = sessionsPerLoop * wks;
    const progress =
      expectedTotal > 0
        ? Math.min(100, (sessionsDone / expectedTotal) * 100)
        : 0;
    const daysElapsed = Math.max(0, (now - start) / 86_400_000);
    const expectedByNow = (sessionsPerLoop * daysElapsed) / 7;
    const workoutsBehind = Math.round(expectedByNow - sessionsDone);

    const programItemIds = new Set(programItemList.map((i) => i.id));
    let lastTraining: string | null = null;
    for (const l of logs) {
      if (!l.completed_at) continue;
      if (!programItemIds.has(l.program_item_id)) continue;
      if (!lastTraining || l.completed_at > lastTraining)
        lastTraining = l.completed_at;
    }
    const daysSinceLastTraining = lastTraining
      ? Math.floor((now - new Date(lastTraining).getTime()) / 86_400_000)
      : null;

    let status: ClientStatus;
    const hasHadTimeToStart = daysElapsed >= 4;
    if (
      hasHadTimeToStart &&
      (daysSinceLastTraining === null || daysSinceLastTraining >= 7)
    ) {
      status = "ghosting";
    } else if (daysLeft < 0) {
      status = "overdue";
    } else if (workoutsBehind >= 2) {
      status = "behind";
    } else if (daysLeft <= 7) {
      status = "ending";
    } else {
      status = "ontrack";
    }

    return {
      status,
      progress,
      daysLeft,
      sessionsDone,
      expectedTotal,
      workoutsBehind,
      daysSinceLastTraining,
      sessionsPerLoop,
    };
  }, [currentProgram, weeks, items, logs, now]);

  /** Flip the active block to archived. Lightweight confirm via the
   *  browser dialog — proper inline UX is queued for later. After the
   *  PATCH we refresh the local programs list so the panel re-renders
   *  in its "no active block" state. */
  const archiveCurrentBlock = async () => {
    if (!currentProgram) return;
    if (
      !confirm(
        `Archive "${currentProgram.title}"? The client will see "no active program" until you assign a new block.`
      )
    )
      return;
    setArchiving(true);
    setError(null);
    try {
      await sbPatch(`programs?id=eq.${currentProgram.id}`, {
        is_archived: true,
      });
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === currentProgram.id ? { ...p, is_archived: true } : p
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setArchiving(false);
    }
  };

  const pendingChecks = useMemo(
    () => checks.filter((c) => c.status === "pending"),
    [checks]
  );

  // Comments scoped to this client: keep threads on items belonging to
  // any of this client's programs (including archived).
  const clientCommentItems = useMemo(() => {
    const itemIds = new Set<string>();
    const allWeekIds = new Set(weeks.map((w) => w.id));
    for (const it of items) {
      if (allWeekIds.has(it.week_id)) itemIds.add(it.id);
    }
    return itemIds;
  }, [weeks, items]);

  const clientComments = useMemo(
    () => comments.filter((c) => clientCommentItems.has(c.item_id)),
    [comments, clientCommentItems]
  );

  // Unanswered threads = latest message in thread is from client.
  const unansweredThreads = useMemo(() => {
    const latestByItem = new Map<string, Comment>();
    for (const c of clientComments) {
      if (!latestByItem.has(c.item_id)) latestByItem.set(c.item_id, c);
    }
    return Array.from(latestByItem.values()).filter(
      (c) => c.author_role === "client"
    );
  }, [clientComments]);

  // Group completed logs into sessions, most recent first.
  const recentSessions = useMemo(() => {
    type SessionGroup = {
      runId: string;
      completedAt: string;
      weekTitle: string | null;
      weekNumber: number;
      programId: string;
      exercises: {
        itemId: string;
        name: string;
        sets: LogRow[];
        unitLabel: string;
      }[];
    };
    const byRun = new Map<string, LogRow[]>();
    for (const l of logs) {
      if (!l.completed_at) continue;
      if (!l.program_items?.program_weeks) continue;
      if (!byRun.has(l.session_run_id)) byRun.set(l.session_run_id, []);
      byRun.get(l.session_run_id)!.push(l);
    }
    const groups: SessionGroup[] = [];
    for (const [runId, runLogs] of byRun) {
      const completedAt = runLogs.reduce(
        (acc, l) => (l.completed_at && l.completed_at > acc ? l.completed_at : acc),
        runLogs[0].completed_at ?? ""
      );
      const week = runLogs[0].program_items!.program_weeks!;
      const byItem = new Map<string, LogRow[]>();
      for (const l of runLogs) {
        if (!byItem.has(l.program_item_id))
          byItem.set(l.program_item_id, []);
        byItem.get(l.program_item_id)!.push(l);
      }
      const exercises: SessionGroup["exercises"] = [];
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
        if (tracking.mode === "none") continue;
        exercises.push({
          itemId,
          name: stripSection(item.custom_name),
          unitLabel: tracking.unitLabel,
          sets: [...itemLogs].sort((a, b) => a.set_number - b.set_number),
        });
      }
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
        weekTitle: week.title,
        weekNumber: week.week_number,
        programId: week.program_id,
        exercises,
      });
    }
    return groups
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 5);
  }, [logs]);

  // Activity timeline: form checks + client comments + coach replies +
  // session completions, mixed chronologically.
  const timeline = useMemo(() => {
    type Item = {
      kind: "form_check" | "client_comment" | "coach_reply" | "session";
      date: string;
      title: string;
      detail?: string;
      link?: string;
    };
    const items: Item[] = [];
    for (const c of pendingChecks.slice(0, 20)) {
      items.push({
        kind: "form_check",
        date: c.created_at,
        title: "Sent a form check",
        detail: c.program_items?.custom_name
          ? stripSection(c.program_items.custom_name)
          : "Exercise",
        link: "/app/admin/form-checks",
      });
    }
    for (const c of clientComments.slice(0, 30)) {
      items.push({
        kind: c.author_role === "client" ? "client_comment" : "coach_reply",
        date: c.created_at,
        title:
          c.author_role === "client"
            ? `Commented on ${c.program_items?.custom_name ? stripSection(c.program_items.custom_name) : "exercise"}`
            : `You replied on ${c.program_items?.custom_name ? stripSection(c.program_items.custom_name) : "exercise"}`,
        detail: c.body.slice(0, 140),
        link: "/app/admin/form-checks",
      });
    }
    for (const s of recentSessions) {
      items.push({
        kind: "session",
        date: s.completedAt,
        title: `Completed ${s.weekTitle?.trim() ? s.weekTitle.trim() : `Session ${s.weekNumber}`}`,
        detail: `${s.exercises.length} exercise${s.exercises.length !== 1 ? "s" : ""} logged`,
      });
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items.slice(0, 12);
  }, [pendingChecks, clientComments, recentSessions]);

  if (loading)
    return <div className="text-muted-foreground">Loading client…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!client) return null;

  const displayName =
    client.first_name && client.last_name
      ? `${client.first_name} ${client.last_name}`
      : client.first_name ?? client.email;

  return (
    <div className="space-y-6">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      {/* ============ HEADER ============ */}
      <section className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <ClientAvatar name={displayName} status={block?.status} />
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-2xl md:text-3xl font-bold">
                {displayName}
              </h1>
              {block && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_BADGE_CLASS[block.status]}`}
                >
                  {STATUS_LABEL[block.status]}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {client.email} · client since {formatDate(client.created_at)}
            </p>
            {intake?.main_goal && (
              <p className="text-xs text-muted-foreground mt-1">
                Goal: {intake.main_goal}
                {intake.specific_skills && intake.specific_skills.length > 0
                  ? ` · ${intake.specific_skills.join(", ")}`
                  : ""}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <Stat
            label="Workouts done"
            value={block ? String(block.sessionsDone) : "—"}
            sub={block ? `block has ${block.expectedTotal}` : "no active block"}
          />
          <Stat
            label="Last trained"
            value={
              block?.daysSinceLastTraining === null ||
              block?.daysSinceLastTraining === undefined
                ? "—"
                : block.daysSinceLastTraining === 0
                  ? "today"
                  : `${block.daysSinceLastTraining}d`
            }
            sub={
              block?.daysSinceLastTraining != null &&
              block.daysSinceLastTraining >= 7
                ? "needs a check-in"
                : ""
            }
            tone={
              block?.daysSinceLastTraining != null &&
              block.daysSinceLastTraining >= 7
                ? "danger"
                : "neutral"
            }
          />
          <Stat
            label="Form checks"
            value={String(pendingChecks.length)}
            sub={pendingChecks.length > 0 ? "waiting review" : "none waiting"}
            tone={pendingChecks.length > 0 ? "accent" : "neutral"}
          />
          <Stat
            label="Comments"
            value={String(unansweredThreads.length)}
            sub={
              unansweredThreads.length > 0 ? "unanswered" : "no open threads"
            }
            tone={unansweredThreads.length > 0 ? "accent" : "neutral"}
          />
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ============ MAIN COLUMN ============ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current block */}
          {currentProgram && block ? (
            <section className="bg-foreground text-background rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider opacity-70 font-semibold mb-1">
                Current block
              </p>
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <h2 className="font-heading text-2xl font-bold">
                  {currentProgram.title}
                </h2>
                <span className="text-sm opacity-80">
                  {block.daysLeft < 0
                    ? `Expired ${Math.abs(block.daysLeft)} day${Math.abs(block.daysLeft) > 1 ? "s" : ""} ago`
                    : `${block.daysLeft} day${block.daysLeft > 1 ? "s" : ""} left`}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className="font-heading text-3xl font-bold">
                  {Math.round(block.progress)}%
                </span>
                <span className="text-sm opacity-80">
                  {block.sessionsDone}/{block.expectedTotal} workouts done ·{" "}
                  {block.workoutsBehind > 1
                    ? `behind by ${block.workoutsBehind}`
                    : block.workoutsBehind === 1
                      ? "behind by 1"
                      : block.workoutsBehind <= -1
                        ? `${Math.abs(block.workoutsBehind)} ahead`
                        : "on track"}
                </span>
              </div>
              <div className="h-2 bg-background/20 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full transition-all ${STATUS_BAR_CLASS[block.status]}`}
                  style={{ width: `${block.progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/app/admin/programs/${currentProgram.id}/edit`}
                  className="inline-flex items-center gap-1.5 bg-accent text-white font-semibold rounded-full px-3 py-2 text-sm hover:opacity-95"
                >
                  <Edit2 size={14} /> Edit current block
                </Link>
                <Link
                  to="/app/admin/programs/new"
                  className="inline-flex items-center gap-1.5 bg-white/10 text-white font-semibold rounded-full px-3 py-2 text-sm hover:bg-white/20"
                >
                  <PlusCircle size={14} /> Build next block
                </Link>
                <Link
                  to={`/app/programs/${currentProgram.slug}`}
                  className="inline-flex items-center gap-1.5 text-white/70 font-semibold rounded-full px-3 py-2 text-sm hover:text-white"
                >
                  View full program
                </Link>
                <button
                  type="button"
                  onClick={archiveCurrentBlock}
                  disabled={archiving}
                  className="inline-flex items-center gap-1.5 text-white/60 font-semibold rounded-full px-3 py-2 text-sm hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {archiving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Archive size={14} />
                  )}
                  {archiving ? "Archiving…" : "Archive"}
                </button>
              </div>
            </section>
          ) : (
            <section className="bg-white border-2 border-dashed border-border rounded-2xl p-6 text-center">
              <h2 className="font-heading text-xl font-bold mb-1">
                No active block
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {programs.length === 0
                  ? "This client doesn't have any program yet."
                  : "Their last block is archived. Build the next one when you're ready."}
              </p>
              <Link
                to="/app/admin/programs/new"
                className="inline-flex items-center gap-2 bg-accent text-white font-semibold rounded-full px-4 py-2 text-sm hover:opacity-95"
              >
                <PlusCircle size={14} /> Build a new block
              </Link>
            </section>
          )}

          {/* Recent training */}
          <section className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-heading text-xl font-bold">
                Recent training
              </h2>
            </div>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No completed sessions yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentSessions.map((s) => (
                  <li
                    key={s.runId}
                    className="bg-muted/40 border border-border rounded-lg p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
                      <p className="font-semibold text-sm">
                        {s.weekTitle?.trim()
                          ? s.weekTitle.trim()
                          : `Session ${s.weekNumber}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.completedAt)} ·{" "}
                        {formatRelative(s.completedAt, now)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {s.exercises.slice(0, 4).map((ex) => (
                        <span key={ex.itemId} className="text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {ex.name}:
                          </span>{" "}
                          {ex.sets
                            .map((set) =>
                              set.reps_done != null ? String(set.reps_done) : "—"
                            )
                            .join(", ")}{" "}
                          {ex.unitLabel}
                        </span>
                      ))}
                      {s.exercises.length > 4 && (
                        <span className="text-muted-foreground italic">
                          +{s.exercises.length - 4} more
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Activity timeline */}
          {timeline.length > 0 && (
            <section className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-heading text-xl font-bold mb-3">
                Activity timeline
              </h2>
              <ul className="space-y-3">
                {timeline.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
                  >
                    <TimelineIcon kind={t.kind} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{t.title}</p>
                      {t.detail && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          {t.detail}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatRelative(t.date, now)}
                      </p>
                    </div>
                    {t.link && (
                      <Link
                        to={t.link}
                        className="text-xs font-semibold text-accent hover:underline self-start whitespace-nowrap"
                      >
                        Open →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ============ SIDEBAR ============ */}
        <aside className="space-y-6">
          {/* Inbox shortcut: counts only, action happens on the Inbox
              page where the actual reply UI lives. We keep this here
              so the coach lands on a client and instantly sees if
              there's anything to action; we don't duplicate the list
              of items because that lives on the Inbox page. */}
          {(pendingChecks.length > 0 || unansweredThreads.length > 0) && (
            <Link
              to={`/app/admin/form-checks#client-${client.id}`}
              className="block bg-white border-2 border-accent/40 rounded-2xl p-5 hover:bg-accent/5 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Send size={18} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-sm">
                    {pendingChecks.length + unansweredThreads.length} item
                    {pendingChecks.length + unansweredThreads.length > 1
                      ? "s"
                      : ""}{" "}
                    waiting your reply
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pendingChecks.length > 0 &&
                      `${pendingChecks.length} form check${pendingChecks.length > 1 ? "s" : ""}`}
                    {pendingChecks.length > 0 &&
                      unansweredThreads.length > 0 &&
                      " · "}
                    {unansweredThreads.length > 0 &&
                      `${unansweredThreads.length} message${unansweredThreads.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <ArrowRight size={16} className="text-accent shrink-0" />
              </div>
            </Link>
          )}

          {/* Intake summary */}
          {intake && (
            <section className="bg-white border border-border rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-heading text-base font-bold flex items-center gap-2">
                  <ClipboardList size={16} /> Intake & level
                </h2>
                <Link
                  to={`/app/admin/clients/${client.id}/intake`}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Full intake →
                </Link>
              </div>
              <ul className="space-y-1 text-xs">
                {intake.max_pull_ups && (
                  <IntakeRowDisplay label="Pull-ups" value={intake.max_pull_ups} />
                )}
                {intake.max_push_ups && (
                  <IntakeRowDisplay label="Push-ups" value={intake.max_push_ups} />
                )}
                {intake.max_dips && (
                  <IntakeRowDisplay label="Dips" value={intake.max_dips} />
                )}
                {intake.deep_squat && (
                  <IntakeRowDisplay
                    label="Squat depth"
                    value={intake.deep_squat}
                  />
                )}
                {intake.handstand && (
                  <IntakeRowDisplay label="Handstand" value={intake.handstand} />
                )}
                {intake.muscle_up && (
                  <IntakeRowDisplay label="Muscle-up" value={intake.muscle_up} />
                )}
                {intake.splits && intake.splits.length > 0 && (
                  <IntakeRowDisplay
                    label="Splits"
                    value={intake.splits.join(", ")}
                  />
                )}
                {intake.shoulder_mobility && (
                  <IntakeRowDisplay
                    label="Shoulders"
                    value={intake.shoulder_mobility}
                  />
                )}
              </ul>
              {intake.submitted_at && (
                <div className="border-t border-border mt-3 pt-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Submitted
                  </p>
                  <p className="text-xs">{formatDate(intake.submitted_at)}</p>
                </div>
              )}
            </section>
          )}

          {/* Past blocks */}
          {programs.filter((p) => p.is_archived).length > 0 && (
            <section className="bg-white border border-border rounded-2xl p-5">
              <h2 className="font-heading text-base font-bold mb-3 flex items-center gap-2">
                <HistoryIcon size={16} /> Past blocks
              </h2>
              <ul className="space-y-2 text-xs">
                {programs
                  .filter((p) => p.is_archived)
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <Link
                        to={`/app/admin/programs/${p.id}/edit`}
                        className="font-semibold hover:text-accent truncate"
                      >
                        {p.title}
                      </Link>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

const ClientAvatar = ({
  name,
  status,
}: {
  name: string;
  status?: ClientStatus;
}) => {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const palette = (() => {
    if (status === "ghosting" || status === "overdue")
      return "bg-red-100 text-red-700";
    if (status === "behind" || status === "ending")
      return "bg-amber-100 text-amber-700";
    if (status === "ontrack") return "bg-green-100 text-green-700";
    return "bg-muted text-muted-foreground";
  })();
  return (
    <div
      className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl shrink-0 ${palette}`}
    >
      {initial}
    </div>
  );
};

const Stat = ({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "accent" | "danger";
}) => {
  const valueClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "accent"
        ? "text-accent"
        : "text-foreground";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className={`font-heading text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
};

const IntakeRowDisplay = ({ label, value }: { label: string; value: string }) => (
  <li className="flex justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold text-right truncate">{value}</span>
  </li>
);

const TimelineIcon = ({
  kind,
}: {
  kind: "form_check" | "client_comment" | "coach_reply" | "session";
}) => {
  if (kind === "form_check") {
    return (
      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        <Video size={14} className="text-accent" />
      </div>
    );
  }
  if (kind === "client_comment") {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <MessageCircle size={14} className="text-muted-foreground" />
      </div>
    );
  }
  if (kind === "coach_reply") {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <ArrowRight size={14} className="text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
      <CheckCircle2 size={14} className="text-green-700" />
    </div>
  );
};

export default AdminClientDetail;
