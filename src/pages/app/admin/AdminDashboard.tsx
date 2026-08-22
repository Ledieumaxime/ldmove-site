import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  Video,
  MessageCircle,
  Bell,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  PlusCircle,
  Inbox,
  UserPlus,
} from "lucide-react";
import { sbGet, sbGetAll, sbPost } from "@/integrations/supabase/api";
import { sendPush } from "@/integrations/supabase/notify";
import { useAuth } from "@/contexts/AuthContext";
import {
  CompletedLog,
  countCompletedSessions,
  listProgramDays,
  ProgramWeekLite,
} from "@/lib/workoutDay";
import InviteClientDialog from "@/components/InviteClientDialog";

/**
 * Coach dashboard. Built around what the coach actually does day-to-day:
 *  - act on inbound stuff (intakes/assessments to validate, form checks
 *    to review, comments to answer)
 *  - eyeball each active client at a glance: are they training? are they
 *    behind? do they have unanswered messages?
 *  - notice clients without an active block (just onboarded, or block
 *    ran out and needs a renewal).
 *
 * Sort order on the active clients list is deliberate: most-urgent first.
 *  ghosting (>7d no training) → block expired → behind by 2+ → on track.
 *  This way the coach lands on rows that need action, not on rows where
 *  everything is fine.
 */

type Program = {
  id: string;
  title: string;
  slug: string;
  assigned_client_id: string | null;
  duration_weeks: number | null;
  created_at: string;
  is_published: boolean;
  is_archived: boolean;
  type: "catalogue" | "custom";
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  archived_at: string | null;
  archive_reason: string | null;
};

const ARCHIVE_REASON_LABEL: Record<string, string> = {
  stopped: "Stopped coaching",
  paused: "On a break",
  never_started: "Never started",
};

type FormCheck = {
  id: string;
  status: "pending" | "reviewed";
  created_at: string;
  client_id: string;
  item_id: string | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
  program_items?: { custom_name: string | null } | null;
};

type Comment = {
  id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  item_id: string;
  dismissed_at: string | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
};

type ClientStatus =
  | "ghosting" // 7+ days no training
  | "overdue" // block expired, needs renewal
  | "ending" // <= 7 days left in block
  | "behind" // workoutsBehind >= 2
  | "ontrack";

type ActiveEntry = {
  program: Program;
  client: Profile;
  status: ClientStatus;
  progress: number;
  daysLeft: number;
  sessionsDone: number;
  expectedTotal: number;
  workoutsBehind: number;
  daysSinceLastTraining: number | null;
  pendingFormChecks: number;
  unansweredComments: number;
  /** TrueCoach-style adherence: sessions done vs expected by today,
   *  capped at 100. Drives the ring color on the client card. */
  compliance: number;
  /** ISO dates (YYYY-MM-DD) with at least one completed session in the
   *  last 7 days — feeds the activity dots. */
  last7Dates: Set<string>;
};

type IdleEntry = {
  client: Profile;
  lastBlockEndedAt: number | null;
  hasIntake: boolean;
};

const STATUS_ORDER: Record<ClientStatus, number> = {
  ghosting: 0,
  overdue: 1,
  behind: 2,
  ending: 3,
  ontrack: 4,
};

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

const STATUS_BORDER_CLASS: Record<ClientStatus, string> = {
  ghosting: "border-red-200",
  overdue: "border-red-200",
  behind: "border-amber-200",
  ending: "border-amber-200",
  ontrack: "border-border",
};

const STATUS_BAR_CLASS: Record<ClientStatus, string> = {
  ghosting: "bg-red-500",
  overdue: "bg-red-500",
  behind: "bg-amber-500",
  ending: "bg-amber-500",
  ontrack: "bg-green-500",
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pendingAssessmentClients, setPendingAssessmentClients] = useState<
    { client_id: string; videoCount: number; firstName: string | null }[]
  >([]);
  const [intakeClientIds, setIntakeClientIds] = useState<Set<string>>(
    new Set()
  );
  const [weeksByProgram, setWeeksByProgram] = useState<
    Map<string, ProgramWeekLite[]>
  >(new Map());
  const [itemsByWeek, setItemsByWeek] = useState<
    Map<string, { id: string; week_id: string; order_index: number }[]>
  >(new Map());
  const [logsByClient, setLogsByClient] = useState<Map<string, CompletedLog[]>>(
    new Map()
  );
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    Promise.all([
      sbGet<Program[]>(
        "programs?select=*&type=eq.custom&order=created_at.desc"
      ),
      sbGet<Profile[]>(
        "profiles?select=id,first_name,last_name,email,created_at,archived_at,archive_reason&role=eq.client&order=created_at.desc"
      ),
      sbGet<FormCheck[]>(
        "form_check_submissions?select=*,profiles(first_name,last_name),program_items(custom_name)&order=created_at.desc&limit=50"
      ),
      sbGet<Comment[]>(
        "exercise_comments?select=*,profiles(first_name,last_name)&order=created_at.desc&limit=300"
      ),
      sbGet<Array<{ client_id: string }>>(
        "assessment_videos?select=client_id"
      ),
      sbGet<Array<{ client_id: string }>>(
        "client_level_assessments?select=client_id"
      ),
      sbGet<Array<{ client_id: string; locked_at: string | null }>>(
        "client_intakes?select=client_id,locked_at"
      ),
      // Cross-program / cross-client reads: paginate explicitly.
      // PostgREST's server-side max-rows (~1000 on Supabase) silently
      // caps any single request even when ?limit=50000 is passed,
      // which drops the newest rows and breaks the session counts.
      sbGetAll<ProgramWeekLite & { program_id: string }>(
        "program_weeks?select=id,week_number,title,program_id"
      ),
      sbGetAll<{ id: string; week_id: string; order_index: number }>(
        "program_items?select=id,week_id,order_index"
      ),
      sbGetAll<CompletedLog & { client_id: string }>(
        "workout_logs?select=client_id,program_item_id,session_run_id,session_date,completed_at&completed_at=not.is.null&order=completed_at.desc"
      ),
    ])
      .then(([allP, c, f, co, videos, reviews, intakes, weeks, items, logs]) => {
        setAllPrograms(allP);
        // Active programs = published + non-archived custom programs.
        setPrograms(
          allP.filter((p) => p.is_published && !p.is_archived)
        );
        setClients(c);
        setChecks(f);
        setComments(co);
        setIntakeClientIds(new Set(intakes.map((r) => r.client_id)));

        const wByProg = new Map<string, ProgramWeekLite[]>();
        for (const w of weeks) {
          if (!wByProg.has(w.program_id)) wByProg.set(w.program_id, []);
          wByProg.get(w.program_id)!.push({
            id: w.id,
            week_number: w.week_number,
            title: w.title,
          });
        }
        setWeeksByProgram(wByProg);

        const iByWeek = new Map<string, typeof items>();
        for (const it of items) {
          if (!iByWeek.has(it.week_id)) iByWeek.set(it.week_id, []);
          iByWeek.get(it.week_id)!.push(it);
        }
        setItemsByWeek(iByWeek);

        const lByClient = new Map<string, CompletedLog[]>();
        for (const l of logs) {
          if (!lByClient.has(l.client_id)) lByClient.set(l.client_id, []);
          lByClient.get(l.client_id)!.push({
            program_item_id: l.program_item_id,
            session_run_id: l.session_run_id,
            session_date: l.session_date,
            completed_at: l.completed_at,
          });
        }
        setLogsByClient(lByClient);

        // Assessment videos waiting for review: client has uploaded but
        // coach hasn't validated yet. We consider an assessment reviewed
        // when ANY of these are true:
        //   - there is at least one row in client_level_assessments
        //   - the coach used the "Mark as reviewed" button (placeholder
        //     row with field_name="_reviewed")
        //   - the intake was locked by the coach (locked_at not null)
        //   The last one matters because locking is the last step of
        //   the review workflow and implies the coach has gone through
        //   everything even if no field was overridden.
        const counts = new Map<string, number>();
        for (const v of videos)
          counts.set(v.client_id, (counts.get(v.client_id) ?? 0) + 1);
        const reviewed = new Set(reviews.map((r) => r.client_id));
        const lockedClientIds = new Set(
          intakes.filter((i) => i.locked_at).map((i) => i.client_id)
        );
        const pendingList: typeof pendingAssessmentClients = [];
        for (const [clientId, videoCount] of counts) {
          if (!reviewed.has(clientId) && !lockedClientIds.has(clientId)) {
            const clientProfile = c.find((x) => x.id === clientId);
            pendingList.push({
              client_id: clientId,
              videoCount,
              firstName: clientProfile?.first_name ?? null,
            });
          }
        }
        setPendingAssessmentClients(pendingList);
      })
      .finally(() => setLoading(false));
    // reloadTick lets the invite dialog trigger a refetch after a
    // successful invite so the new client shows up without a manual
    // page reload.
  }, [reloadTick]);

  // Refetch when the tab regains focus. Otherwise the dashboard stays
  // frozen on whatever was loaded at first mount, and a coach who
  // switches to a client account to test, then comes back, sees a
  // stale workout count.
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

  // Index pending form checks by client.
  const pendingChecksByClient = useMemo(() => {
    const map = new Map<string, FormCheck[]>();
    for (const c of checks) {
      if (c.status !== "pending") continue;
      if (!map.has(c.client_id)) map.set(c.client_id, []);
      map.get(c.client_id)!.push(c);
    }
    return map;
  }, [checks]);

  // Items that already have a pending form check waiting. Comment
  // threads on the same items are dedup'd out of the inbox count
  // because the coach reviews the comment alongside the video — no
  // need to surface it as a second notification.
  const itemsWithPendingCheck = useMemo(() => {
    const set = new Set<string>();
    for (const c of checks) {
      if (c.status === "pending" && c.item_id) set.add(c.item_id);
    }
    return set;
  }, [checks]);

  // Unanswered comment threads. A thread is unanswered when the most
  // recent message in it is from the client. We attribute the thread
  // to the client via author_id of the latest client comment.
  // Threads on items that already have a pending form check are
  // skipped so the same exercise doesn't generate two notifications.
  const unansweredCommentsByClient = useMemo(() => {
    const latestByItem = new Map<string, Comment>();
    for (const c of comments) {
      if (!latestByItem.has(c.item_id)) latestByItem.set(c.item_id, c);
    }
    const map = new Map<string, Comment[]>();
    for (const c of latestByItem.values()) {
      if (c.author_role !== "client" || !c.author_id) continue;
      if (itemsWithPendingCheck.has(c.item_id)) continue;
      // Coach used "Skip — nothing to reply" on this thread: keep it
      // out of the inbox until the client writes something new.
      if (c.dismissed_at) continue;
      if (!map.has(c.author_id)) map.set(c.author_id, []);
      map.get(c.author_id)!.push(c);
    }
    return map;
  }, [comments, itemsWithPendingCheck]);

  const totalPendingChecks = useMemo(
    () => checks.filter((c) => c.status === "pending"),
    [checks]
  );
  const totalUnansweredComments = useMemo(
    () =>
      Array.from(unansweredCommentsByClient.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    [unansweredCommentsByClient]
  );

  // Build per-client active entries.
  const activeEntries: ActiveEntry[] = useMemo(() => {
    const list: ActiveEntry[] = [];
    for (const p of programs) {
      const client = clients.find((c) => c.id === p.assigned_client_id);
      if (!client) continue;
      // Archived clients have their own section at the bottom.
      if (client.archived_at) continue;

      const start = new Date(p.created_at).getTime();
      const weeks = p.duration_weeks ?? 4;
      const end = start + weeks * 7 * 86_400_000;
      const daysLeft = Math.ceil((end - now) / 86_400_000);

      const programWeeks = weeksByProgram.get(p.id) ?? [];
      const itemsForProgram = programWeeks.flatMap(
        (w) => itemsByWeek.get(w.id) ?? []
      );
      const days = listProgramDays(programWeeks, itemsForProgram);
      const clientLogs = logsByClient.get(client.id) ?? [];
      const sessionsDone = countCompletedSessions(days, clientLogs);
      const sessionsPerLoop = days.length;
      const expectedTotal = sessionsPerLoop * weeks;
      const progress =
        expectedTotal > 0
          ? Math.min(100, (sessionsDone / expectedTotal) * 100)
          : 0;

      const daysElapsed = Math.max(0, (now - start) / 86_400_000);
      const expectedByNow = (sessionsPerLoop * daysElapsed) / 7;
      // Cap at the block's actual remaining sessions: once a block is
      // past its end date expectedByNow keeps growing linearly and the
      // chip drifts into absurd territory ("46 sessions behind" on a
      // 25-session block).
      const workoutsBehind = Math.min(
        Math.round(expectedByNow - sessionsDone),
        Math.max(0, expectedTotal - sessionsDone)
      );

      // Last training timestamp for this client, scoped to the active
      // block — same logs but pinned to this program's items.
      const programItemIds = new Set(
        itemsForProgram.map((i) => i.id)
      );
      let lastTraining: string | null = null;
      for (const l of clientLogs) {
        if (!programItemIds.has(l.program_item_id)) continue;
        if (!lastTraining || (l.completed_at ?? "") > lastTraining)
          lastTraining = l.completed_at;
      }
      const daysSinceLastTraining = lastTraining
        ? Math.floor((now - new Date(lastTraining).getTime()) / 86_400_000)
        : null;

      // Status priority: ghosting (>7d no training, but block was assigned
      // long enough ago to expect training) → overdue (block expired) →
      // behind (>= 2 workouts late) → ending (block ends in <= 7d) →
      // ontrack.
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

      const compliance =
        expectedByNow >= 1
          ? Math.min(100, Math.round((sessionsDone / expectedByNow) * 100))
          : 100;

      const last7Dates = new Set<string>();
      const cutoff = now - 7 * 86_400_000;
      for (const l of clientLogs) {
        if (!programItemIds.has(l.program_item_id)) continue;
        if (!l.completed_at) continue;
        if (new Date(l.completed_at).getTime() < cutoff) continue;
        last7Dates.add(l.session_date);
      }

      list.push({
        program: p,
        client,
        status,
        progress,
        daysLeft,
        sessionsDone,
        expectedTotal,
        workoutsBehind,
        daysSinceLastTraining,
        pendingFormChecks: pendingChecksByClient.get(client.id)?.length ?? 0,
        unansweredComments:
          unansweredCommentsByClient.get(client.id)?.length ?? 0,
        compliance,
        last7Dates,
      });
    }
    return list.sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      // Within same status, more behind first, then more inbox.
      const inboxA = a.pendingFormChecks + a.unansweredComments;
      const inboxB = b.pendingFormChecks + b.unansweredComments;
      if (inboxA !== inboxB) return inboxB - inboxA;
      return b.workoutsBehind - a.workoutsBehind;
    });
  }, [
    programs,
    clients,
    weeksByProgram,
    itemsByWeek,
    logsByClient,
    pendingChecksByClient,
    unansweredCommentsByClient,
    now,
  ]);

  // Clients without an active program. Either fresh onboards or
  // expired-and-not-renewed.
  // Clients the coach has retired: out of every working list, kept in
  // their own collapsed section so the history stays one click away.
  const archivedClients = useMemo(
    () =>
      clients
        .filter((c) => c.archived_at)
        .sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? "")),
    [clients]
  );

  const idleEntries: IdleEntry[] = useMemo(() => {
    const activeClientIds = new Set(
      programs.map((p) => p.assigned_client_id).filter(Boolean) as string[]
    );
    const list: IdleEntry[] = [];
    for (const c of clients) {
      if (activeClientIds.has(c.id)) continue;
      if (c.archived_at) continue;
      // Find their most recent custom program (might be archived).
      const past = allPrograms
        .filter((p) => p.assigned_client_id === c.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const lastBlockEndedAt = past
        ? new Date(past.created_at).getTime() +
          (past.duration_weeks ?? 4) * 7 * 86_400_000
        : null;
      list.push({
        client: c,
        lastBlockEndedAt,
        hasIntake: intakeClientIds.has(c.id),
      });
    }
    // Surface fresh onboards (no past block) first, then most-recently-ended.
    return list.sort((a, b) => {
      if (a.lastBlockEndedAt === null && b.lastBlockEndedAt !== null) return -1;
      if (b.lastBlockEndedAt === null && a.lastBlockEndedAt !== null) return 1;
      return (b.lastBlockEndedAt ?? 0) - (a.lastBlockEndedAt ?? 0);
    });
  }, [programs, allPrograms, clients, intakeClientIds]);

  // Recent activity feed (kept).
  type Event = {
    kind: "form_check" | "comment";
    date: string;
    name: string;
    detail: string;
    link: string;
    clientId: string | null;
  };
  const events: Event[] = useMemo(() => {
    const out: Event[] = [];
    for (const c of checks.slice(0, 20)) {
      out.push({
        kind: "form_check",
        date: c.created_at,
        name: `${c.profiles?.first_name ?? "Client"} sent a form check`,
        detail: c.program_items?.custom_name ?? "Exercise",
        link: "/app/admin/form-checks",
        clientId: c.client_id,
      });
    }
    for (const c of comments
      .filter((c) => c.author_role === "client")
      .slice(0, 20)) {
      out.push({
        kind: "comment",
        date: c.created_at,
        name: `${c.profiles?.first_name ?? "Client"} commented`,
        detail: c.body.slice(0, 100),
        link: "/app/admin/form-checks",
        clientId: c.author_id,
      });
    }
    out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return out.slice(0, 10);
  }, [checks, comments]);

  // Nudge: one-click "get back on it" notification for a client who's
  // falling behind. Uses the notifications table (coach has write RLS);
  // the client sees it as a banner on their dashboard.
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  const nudgeClient = async (clientId: string) => {
    try {
      const nudgeBody = "Your next session is ready when you are. Jump back in.";
      await sbPost("notifications", {
        user_id: clientId,
        type: "nudge",
        title: "A nudge from your coach",
        body: nudgeBody,
        link_url: "/app/today",
      });
      // A nudge is the one notification that is worthless if it waits for
      // the client to open the app on their own.
      void sendPush(clientId, "A nudge from your coach", nudgeBody, "/app/today");
      setNudgedIds((prev) => new Set(prev).add(clientId));
    } catch (e) {
      console.error("nudge failed", e);
    }
  };

  const oldestCheckDays = (() => {
    if (totalPendingChecks.length === 0) return null;
    const oldest = totalPendingChecks.reduce(
      (min, c) => (c.created_at < min ? c.created_at : min),
      totalPendingChecks[0].created_at
    );
    return Math.floor((now - new Date(oldest).getTime()) / 86_400_000);
  })();

  const behindCount = activeEntries.filter(
    (e) => e.status === "ghosting" || e.status === "overdue" || e.status === "behind"
  ).length;

  if (loading)
    return <div className="text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">
            Coach Dashboard
          </p>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Hi {profile?.first_name ?? "Coach"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-foreground text-background rounded-full px-3 py-2 hover:bg-foreground/90 transition"
        >
          <UserPlus size={14} /> Invite client
        </button>
      </div>

      <InviteClientDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => setReloadTick((t) => t + 1)}
      />

      {/* ============ STAT STRIP ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Active clients</p>
          <p className="font-heading text-2xl font-bold">{activeEntries.length}</p>
        </div>
        <Link
          to="/app/admin/form-checks"
          className="bg-white border border-border rounded-2xl p-4 hover:shadow-sm transition"
        >
          <p className="text-xs text-muted-foreground mb-1">Form checks</p>
          <p className="font-heading text-2xl font-bold">
            {totalPendingChecks.length}
            {oldestCheckDays != null && oldestCheckDays >= 1 && (
              <span className="text-xs font-semibold text-amber-600 ml-2">
                oldest {oldestCheckDays}d
              </span>
            )}
          </p>
        </Link>
        <Link
          to="/app/admin/form-checks"
          className="bg-white border border-border rounded-2xl p-4 hover:shadow-sm transition"
        >
          <p className="text-xs text-muted-foreground mb-1">Messages</p>
          <p className="font-heading text-2xl font-bold">{totalUnansweredComments}</p>
        </Link>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Falling behind</p>
          <p
            className={`font-heading text-2xl font-bold ${
              behindCount > 0 ? "text-red-600" : ""
            }`}
          >
            {behindCount}
          </p>
        </div>
      </div>

      {/* ============ ASSESSMENT REVIEW (onboarding-level alert) ============ */}
      {pendingAssessmentClients.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Bell size={18} className="text-amber-700" />
            </div>
            <div>
              <p className="font-heading font-bold">
                {pendingAssessmentClients.length} assessment
                {pendingAssessmentClients.length > 1 ? "s" : ""} waiting for
                your review
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingAssessmentClients
                  .slice(0, 3)
                  .map(
                    (c) =>
                      `${c.firstName ?? "Client"} (${c.videoCount} video${
                        c.videoCount > 1 ? "s" : ""
                      })`
                  )
                  .join(" · ")}
                {pendingAssessmentClients.length > 3 &&
                  ` · +${pendingAssessmentClients.length - 3} more`}
              </p>
            </div>
          </div>
          {/* When several assessments are waiting we just open the first
              one — the coach goes through them one by one and comes back
              to the dashboard for the next. */}
          <Link
            to={`/app/admin/clients/${pendingAssessmentClients[0].client_id}/intake`}
            className="inline-flex items-center gap-1 text-sm font-semibold bg-amber-700 text-white rounded-full px-4 py-2 hover:bg-amber-800"
          >
            Review {pendingAssessmentClients.length === 1 ? "now" : "first"}{" "}
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ============ INBOX PANEL ============ */}
      {/* Per-client breakdown of form checks + unanswered comments. One
          line per client with something pending; click to open their
          page (where the actual reply UI lives). When empty we hide
          the panel entirely — no point taking up space. */}
      {(totalPendingChecks.length > 0 || totalUnansweredComments > 0) && (
        <section className="bg-white border-2 border-accent/40 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 bg-accent/5 border-b border-accent/20">
            <div className="flex items-center gap-2">
              <Inbox size={16} className="text-accent" />
              <p className="font-heading font-bold">
                Inbox ·{" "}
                {totalPendingChecks.length + totalUnansweredComments} item
                {totalPendingChecks.length + totalUnansweredComments > 1
                  ? "s"
                  : ""}{" "}
                waiting
              </p>
            </div>
            <Link
              to="/app/admin/form-checks"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open full inbox →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {Array.from(
              new Set([
                ...pendingChecksByClient.keys(),
                ...unansweredCommentsByClient.keys(),
              ])
            ).map((clientId) => {
              const client = clients.find((c) => c.id === clientId);
              if (!client) return null;
              const formCheckCount =
                pendingChecksByClient.get(clientId)?.length ?? 0;
              const commentCount =
                unansweredCommentsByClient.get(clientId)?.length ?? 0;
              return (
                <li key={clientId}>
                  <Link
                    to={`/app/admin/form-checks#client-${clientId}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {client.first_name ?? client.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {formCheckCount > 0 && (
                        <span className="inline-flex items-center gap-1 bg-accent/10 text-accent font-semibold px-2 py-1 rounded">
                          <Video size={11} /> {formCheckCount} form check
                          {formCheckCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {commentCount > 0 && (
                        <span className="inline-flex items-center gap-1 bg-muted font-semibold px-2 py-1 rounded">
                          <MessageCircle size={11} /> {commentCount} message
                          {commentCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground shrink-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ============ ACTIVE CLIENTS ============ */}
      <section>
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-heading text-xl font-bold">Active clients</h2>
          {activeEntries.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {activeEntries.length} with an active block · sorted by what
              needs attention
            </span>
          )}
        </div>

        {activeEntries.length === 0 ? (
          <p className="bg-white border border-border rounded-2xl p-5 text-sm text-muted-foreground">
            No clients with an active block right now.
            {clients.length > 0
              ? " Build a block from a client's page below."
              : " Use the Invite client button above to get started."}
          </p>
        ) : (
          <div className="space-y-2">
            {activeEntries.map((e) => (
              <Link
                key={e.program.id}
                to={`/app/admin/clients/${e.client.id}`}
                className={`block bg-white border rounded-2xl p-4 hover:shadow-md transition ${STATUS_BORDER_CLASS[e.status]}`}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <ComplianceRing
                    compliance={e.compliance}
                    initial={(e.client.first_name ?? e.client.email).charAt(0).toUpperCase()}
                  />
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-heading font-bold">
                        {e.client.first_name ?? e.client.email}
                      </p>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_BADGE_CLASS[e.status]}`}
                      >
                        {STATUS_LABEL[e.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {e.program.title} · {describeBlockTime(e)}
                    </p>
                  </div>
                  <SevenDayDots dates={e.last7Dates} now={now} />
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="font-semibold">
                      {e.expectedTotal > 0
                        ? `${e.sessionsDone}/${e.expectedTotal} done`
                        : "0 sessions"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-accent shrink-0">
                    Open →
                  </span>
                </div>

                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full ${STATUS_BAR_CLASS[e.status]}`}
                    style={{ width: `${e.progress}%` }}
                  />
                </div>

                <div className="flex items-center gap-2 mt-2.5 text-xs flex-wrap">
                  {e.workoutsBehind >= 2 && (
                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full">
                      {e.workoutsBehind} sessions behind
                    </span>
                  )}
                  {e.pendingFormChecks > 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-semibold px-2 py-1 rounded-full">
                      <Video size={11} /> {e.pendingFormChecks} form check
                      {e.pendingFormChecks > 1 ? "s" : ""}
                    </span>
                  )}
                  {e.unansweredComments > 0 && (
                    <span className="inline-flex items-center gap-1 bg-accent/10 text-accent font-semibold px-2 py-1 rounded-full">
                      <MessageCircle size={11} /> {e.unansweredComments} message
                      {e.unansweredComments > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {describeLastTraining(e)}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        navigate(`/app/admin/clients/${e.client.id}/dashboard`);
                      }}
                      className="inline-flex items-center gap-1 font-semibold px-3 py-1 rounded-full border border-border hover:bg-muted/50 text-foreground transition"
                    >
                      <Eye size={11} /> Dashboard
                    </button>
                    {(e.status === "ghosting" || e.status === "behind") && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (!nudgedIds.has(e.client.id)) nudgeClient(e.client.id);
                        }}
                        className={`inline-flex items-center gap-1 font-semibold px-3 py-1 rounded-full border transition ${
                          nudgedIds.has(e.client.id)
                            ? "border-green-200 bg-green-50 text-green-700 cursor-default"
                            : "border-border hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        {nudgedIds.has(e.client.id) ? (
                          <>Nudged ✓</>
                        ) : (
                          <>
                            <Bell size={11} /> Nudge
                          </>
                        )}
                      </button>
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ============ WITHOUT ACTIVE PROGRAM ============ */}
      {idleEntries.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-heading text-base font-bold text-muted-foreground">
              Without active program
            </h2>
            <span className="text-xs text-muted-foreground">
              {idleEntries.length} client
              {idleEntries.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="bg-white border border-border rounded-2xl divide-y divide-border">
            {idleEntries.map((e) => (
              <Link
                key={e.client.id}
                to={`/app/admin/clients/${e.client.id}`}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition"
              >
                <Avatar name={e.client.first_name ?? e.client.email} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {e.client.first_name ?? e.client.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {describeIdle(e, now)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-accent shrink-0 inline-flex items-center gap-1">
                  <PlusCircle size={14} />
                  {e.lastBlockEndedAt ? "Build next block" : "Build first block"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============ FORMER CLIENTS ============ */}
      {archivedClients.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 mb-3 text-base font-heading font-bold text-muted-foreground hover:text-foreground"
          >
            <Archive size={16} />
            Former clients ({archivedClients.length})
            {showArchived ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          {showArchived && (
            <div className="bg-white border border-border rounded-2xl divide-y divide-border">
              {archivedClients.map((c) => (
                <Link
                  key={c.id}
                  to={`/app/admin/clients/${c.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {c.first_name ?? c.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.archive_reason
                        ? ARCHIVE_REASON_LABEL[c.archive_reason] ??
                          c.archive_reason
                        : "Archived"}
                      {c.archived_at
                        ? ` · since ${new Date(c.archived_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    Open →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============ RECENT ACTIVITY ============ */}
      {events.length > 0 && (
        <section className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-heading text-xl font-bold mb-3">
            Recent activity
          </h2>
          <ul className="space-y-1">
            {events.map((e, i) => (
              <li key={i}>
                <Link
                  to={e.link}
                  className="flex items-start gap-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-2 -mx-2"
                >
                  <div className="mt-0.5">
                    {e.kind === "form_check" ? (
                      <Video size={14} className="text-muted-foreground" />
                    ) : (
                      <MessageCircle
                        size={14}
                        className="text-muted-foreground"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{e.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.detail}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatRelative(e.date, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const Avatar = ({
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
      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${palette}`}
    >
      {initial}
    </div>
  );
};

function describeBlockTime(e: ActiveEntry): string {
  if (e.daysLeft < 0)
    return `ended ${Math.abs(e.daysLeft)} day${Math.abs(e.daysLeft) > 1 ? "s" : ""} ago, needs renewal`;
  return `${e.daysLeft} day${e.daysLeft > 1 ? "s" : ""} left in block`;
}

function describeWorkSignal(e: ActiveEntry): string {
  if (e.expectedTotal <= 0) return "—";
  if (e.workoutsBehind > 1) return `behind by ${e.workoutsBehind}`;
  if (e.workoutsBehind === 1) return "behind by 1";
  if (e.workoutsBehind <= -1) return `${Math.abs(e.workoutsBehind)} ahead`;
  return "on track";
}

function describeLastTraining(e: ActiveEntry): string {
  if (e.daysSinceLastTraining === null) return "Never trained";
  if (e.daysSinceLastTraining === 0) return "Trained today";
  if (e.daysSinceLastTraining === 1) return "Trained yesterday";
  return `Trained ${e.daysSinceLastTraining} days ago`;
}

function describeIdle(e: IdleEntry, now: number): string {
  if (e.lastBlockEndedAt === null) {
    if (!e.hasIntake) return "Just signed up · waiting for intake";
    const daysSinceJoin = Math.floor(
      (now - new Date(e.client.created_at).getTime()) / 86_400_000
    );
    return `Onboarded ${daysSinceJoin} day${daysSinceJoin !== 1 ? "s" : ""} ago · ready for first block`;
  }
  const daysSinceEnd = Math.floor((now - e.lastBlockEndedAt) / 86_400_000);
  if (daysSinceEnd <= 0) return "Block just ended · time for the next one";
  return `Last block ended ${daysSinceEnd} day${daysSinceEnd > 1 ? "s" : ""} ago · needs renewal`;
}

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

// TrueCoach-style adherence ring: sessions done vs expected by today.
// Green >= 85, amber >= 60, red below.
const ComplianceRing = ({
  compliance,
  initial,
}: {
  compliance: number;
  initial: string;
}) => {
  const C = 2 * Math.PI * 16;
  const color =
    compliance >= 85
      ? "text-green-500"
      : compliance >= 60
        ? "text-amber-500"
        : "text-red-500";
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <title>{`Adherence ${compliance}%`}</title>
      <circle cx="22" cy="22" r="16" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
      <circle
        cx="22" cy="22" r="16" fill="none"
        stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        className={color}
        strokeDasharray={`${Math.round((compliance / 100) * C)} ${Math.round(C)}`}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" className="text-foreground">
        {initial}
      </text>
    </svg>
  );
};

// Last-7-days activity: one dot per day, filled when the client
// completed at least one session that day. Oldest on the left.
const SevenDayDots = ({ dates, now }: { dates: Set<string>; now: number }) => {
  const days: { iso: string; done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ iso, done: dates.has(iso) });
  }
  return (
    <div className="hidden md:flex items-center gap-1" title="Last 7 days">
      {days.map((d) => (
        <span
          key={d.iso}
          className={`w-2 h-2 rounded-full ${
            d.done ? "bg-green-500" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
};

export default AdminDashboard;
