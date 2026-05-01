import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Clock,
  CheckCircle2,
  MessageCircle,
  Video,
  ChevronDown,
  ChevronUp,
  Check,
  Archive,
  X,
  Inbox as InboxIcon,
} from "lucide-react";
import { sbGet, sbPatch } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExerciseComments from "@/components/ExerciseComments";
import BackToDashboard from "@/components/BackToDashboard";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

async function signUrl(path: string): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/form-checks/${path}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 1800 }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl ?? ""}`;
  } catch {
    return null;
  }
}

type FormCheck = {
  id: string;
  item_id: string | null;
  client_id: string;
  video_url: string | null;
  client_note: string | null;
  coach_feedback: string | null;
  status: "pending" | "reviewed";
  created_at: string;
  reviewed_at: string | null;
  archived_as_progress: boolean;
  archived_note: string | null;
  archived_at: string | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
  program_items?: { custom_name: string | null } | null;
};

type CommentRow = {
  id: string;
  item_id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  created_at: string;
  body: string;
  profiles?: { first_name: string | null; last_name: string | null } | null;
  program_items?: { custom_name: string | null } | null;
};

type Thread = {
  item_id: string;
  exerciseName: string;
  clientId: string | null;
  clientName: string;
  lastBody: string;
  lastAt: string;
  count: number;
  needsReply: boolean;
};

type PendingItem =
  | { kind: "form_check"; date: string; check: FormCheck }
  | { kind: "thread"; date: string; thread: Thread };

type ClientSection = {
  clientId: string;
  clientName: string;
  items: PendingItem[]; // oldest first
  oldestDate: string; // for section sort
  totalCount: number;
};

const formatRelativeShort = (iso: string, now: number) => {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const waitingTone = (iso: string, now: number): "red" | "amber" | "grey" => {
  const days = (now - new Date(iso).getTime()) / 86_400_000;
  if (days >= 3) return "red";
  if (days >= 1) return "amber";
  return "grey";
};

const waitingBadgeClass: Record<"red" | "amber" | "grey", string> = {
  red: "bg-red-100 text-red-700 border border-red-200",
  amber: "bg-amber-100 text-amber-700 border border-amber-200",
  grey: "bg-muted text-muted-foreground border border-border",
};

const AdminFormChecks = () => {
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [rows, allComments] = await Promise.all([
        sbGet<FormCheck[]>(
          "form_check_submissions?select=*,profiles(first_name,last_name),program_items(custom_name)&order=created_at.desc"
        ),
        sbGet<CommentRow[]>(
          "exercise_comments?select=*,profiles(first_name,last_name),program_items(custom_name)&order=created_at.desc&limit=200"
        ),
      ]);
      setChecks(rows);

      // Group comments by item_id. Since they arrive sorted desc, first
      // in list = most recent.
      const byItem = new Map<string, CommentRow[]>();
      for (const c of allComments) {
        if (!byItem.has(c.item_id)) byItem.set(c.item_id, []);
        byItem.get(c.item_id)!.push(c);
      }
      const threadsOut: Thread[] = [];
      for (const [item_id, cs] of byItem) {
        const last = cs[0];
        const clientMsg = cs.find((c) => c.author_role === "client");
        threadsOut.push({
          item_id,
          exerciseName: cs[0]?.program_items?.custom_name ?? "Exercise",
          clientId: clientMsg?.author_id ?? null,
          clientName: clientMsg?.profiles?.first_name ?? "Client",
          lastBody: last.body,
          lastAt: last.created_at,
          count: cs.length,
          needsReply: last.author_role === "client",
        });
      }
      threadsOut.sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      );
      setThreads(threadsOut);

      const sigs: Record<string, string> = {};
      for (const r of rows) {
        if (r.video_url) {
          const s = await signUrl(r.video_url);
          if (s) sigs[r.id] = s;
        }
      }
      setSignedUrls(sigs);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Build per-client sections from pending form checks + unanswered
  // threads. Sections sort by age of oldest item; items within each
  // section sort oldest first too — coach works top-down.
  // Comment threads on items that already have a pending form check
  // are folded into the form check entry so the coach doesn't see
  // the same exercise twice — replying inside the form check card
  // covers both.
  const sections: ClientSection[] = useMemo(() => {
    const map = new Map<string, ClientSection>();
    const itemsWithPendingCheck = new Set<string>();
    for (const c of checks) {
      if (c.status !== "pending") continue;
      const id = c.client_id;
      const name = c.profiles?.first_name ?? "Client";
      if (!map.has(id)) {
        map.set(id, {
          clientId: id,
          clientName: name,
          items: [],
          oldestDate: c.created_at,
          totalCount: 0,
        });
      }
      const sec = map.get(id)!;
      sec.items.push({ kind: "form_check", date: c.created_at, check: c });
      sec.totalCount++;
      if (c.created_at < sec.oldestDate) sec.oldestDate = c.created_at;
      if (c.item_id) itemsWithPendingCheck.add(c.item_id);
    }
    for (const t of threads) {
      if (!t.needsReply) continue;
      if (!t.clientId) continue;
      if (itemsWithPendingCheck.has(t.item_id)) continue;
      if (!map.has(t.clientId)) {
        map.set(t.clientId, {
          clientId: t.clientId,
          clientName: t.clientName,
          items: [],
          oldestDate: t.lastAt,
          totalCount: 0,
        });
      }
      const sec = map.get(t.clientId)!;
      sec.items.push({ kind: "thread", date: t.lastAt, thread: t });
      sec.totalCount++;
      if (t.lastAt < sec.oldestDate) sec.oldestDate = t.lastAt;
    }
    const out = Array.from(map.values());
    for (const s of out) {
      s.items.sort((a, b) => a.date.localeCompare(b.date));
    }
    out.sort((a, b) => a.oldestDate.localeCompare(b.oldestDate));
    return out;
  }, [checks, threads]);

  // The URL hash can deep-link to a specific client section (e.g.
  // #client-uuid). Auto-expand that section and scroll to it once
  // sections render. Without a hash we open every section by default
  // so the inbox shows everything at first paint.
  useLayoutEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    if (hash.startsWith("client-")) {
      const target = hash.slice("client-".length);
      // Collapse all except the target.
      const next = new Set<string>();
      for (const s of sections) {
        if (s.clientId !== target) next.add(s.clientId);
      }
      setCollapsed(next);
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Legacy anchors from old links — just scroll there.
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, sections]);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );

  const reviewedChecks = checks.filter((c) => c.status === "reviewed");
  const answeredThreads = threads.filter((t) => !t.needsReply);
  const totalPending = sections.reduce((sum, s) => sum + s.totalCount, 0);
  const now = Date.now();

  return (
    <div className="space-y-6 max-w-3xl">
      <BackToDashboard />
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold flex items-center gap-2">
          <InboxIcon size={26} /> Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Form checks and comments waiting for you, grouped by client.
          Oldest at the top.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-8 text-center space-y-2">
          <CheckCircle2 className="mx-auto text-green-600" size={28} />
          <h2 className="font-heading text-xl font-bold">All caught up</h2>
          <p className="text-sm text-muted-foreground">
            No pending form checks or unanswered messages. Nice work.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {totalPending} item{totalPending !== 1 ? "s" : ""} across{" "}
            {sections.length} client{sections.length !== 1 ? "s" : ""}
          </p>

          <div className="space-y-3">
            {sections.map((s) => {
              const isCollapsed = collapsed.has(s.clientId);
              const tone = waitingTone(s.oldestDate, now);
              return (
                <section
                  key={s.clientId}
                  id={`client-${s.clientId}`}
                  className="bg-white border border-border rounded-2xl overflow-hidden scroll-mt-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(s.clientId)}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold shrink-0">
                      {(s.clientName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-bold text-base">
                          {s.clientName}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${waitingBadgeClass[tone]}`}
                        >
                          {formatRelativeShort(s.oldestDate, now)} waiting
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.totalCount} item{s.totalCount !== 1 ? "s" : ""}{" "}
                        pending
                      </p>
                    </div>
                    {isCollapsed ? (
                      <ChevronDown
                        size={18}
                        className="text-muted-foreground shrink-0"
                      />
                    ) : (
                      <ChevronUp
                        size={18}
                        className="text-muted-foreground shrink-0"
                      />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                      {s.items.map((it) =>
                        it.kind === "form_check" ? (
                          <CheckCard
                            key={`fc-${it.check.id}`}
                            check={it.check}
                            videoSrc={signedUrls[it.check.id]}
                            onUpdated={load}
                          />
                        ) : (
                          <ThreadCard
                            key={`th-${it.thread.item_id}`}
                            thread={it.thread}
                          />
                        )
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* === ARCHIVED === */}
      {(reviewedChecks.length > 0 || answeredThreads.length > 0) && (
        <section className="space-y-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="inline-flex items-center gap-2 hover:text-accent"
          >
            <CheckCircle2 size={20} className="text-muted-foreground" />
            <h2 className="font-heading text-2xl font-bold">
              Archived ({reviewedChecks.length + answeredThreads.length})
            </h2>
            {showArchived ? (
              <ChevronUp size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </button>
          {showArchived && (
            <div className="space-y-6">
              {answeredThreads.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Answered comments
                  </p>
                  <div className="space-y-3">
                    {answeredThreads.map((t) => (
                      <ThreadCard key={t.item_id} thread={t} compact />
                    ))}
                  </div>
                </div>
              )}
              {reviewedChecks.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Reviewed form checks
                  </p>
                  <div className="space-y-3">
                    {reviewedChecks.map((c) => (
                      <CheckCard
                        key={c.id}
                        check={c}
                        videoSrc={signedUrls[c.id]}
                        onUpdated={load}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const ThreadCard = ({
  thread,
  compact = false,
}: {
  thread: Thread;
  compact?: boolean;
}) => {
  const [open, setOpen] = useState(!compact);
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        thread.needsReply ? "border-accent/30" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <MessageCircle
                size={14}
                className="text-muted-foreground shrink-0"
              />
              <span className="font-semibold">{thread.exerciseName}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 truncate inline-flex items-center gap-1.5">
              {thread.needsReply ? (
                <MessageCircle size={12} className="shrink-0 text-accent" />
              ) : (
                <Check size={12} className="shrink-0 text-green-600" />
              )}
              "{thread.lastBody}"
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-muted-foreground">
              {new Date(thread.lastAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="inline-flex items-center gap-1 mt-1 text-xs font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
              <MessageCircle size={11} /> {thread.count}
            </div>
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-border">
          <ExerciseComments itemId={thread.item_id} />
        </div>
      )}
    </div>
  );
};

const CheckCard = ({
  check,
  videoSrc,
  onUpdated,
}: {
  check: FormCheck;
  videoSrc: string | undefined;
  onUpdated: () => void;
}) => {
  const [saving, setSaving] = useState(false);
  const [archiveFormOpen, setArchiveFormOpen] = useState(false);
  const [archiveNote, setArchiveNote] = useState(check.archived_note ?? "");

  const toggleReviewed = async () => {
    setSaving(true);
    try {
      const nextStatus = check.status === "reviewed" ? "pending" : "reviewed";
      await sbPatch(`form_check_submissions?id=eq.${check.id}`, {
        status: nextStatus,
        reviewed_at:
          nextStatus === "reviewed" ? new Date().toISOString() : null,
      });
      onUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    setSaving(true);
    try {
      await sbPatch(`form_check_submissions?id=eq.${check.id}`, {
        archived_as_progress: true,
        archived_note: archiveNote.trim() || null,
        archived_at: new Date().toISOString(),
      });
      setArchiveFormOpen(false);
      onUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const unarchive = async () => {
    setSaving(true);
    try {
      await sbPatch(`form_check_submissions?id=eq.${check.id}`, {
        archived_as_progress: false,
        archived_at: null,
      });
      onUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <Video size={14} className="text-muted-foreground" />
            <span className="font-semibold">
              {check.program_items?.custom_name ?? "Exercise"}
            </span>
            <Clock size={12} className="text-muted-foreground ml-2" />
            <span className="text-xs text-muted-foreground">
              {new Date(check.created_at).toLocaleDateString("en-US")}
            </span>
          </div>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${
            check.status === "pending"
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {check.status === "pending" ? "Pending" : "Reviewed"}
        </span>
      </div>

      {check.client_note && (
        <div className="bg-muted/40 border border-border rounded-lg p-3 mb-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1 inline-flex items-center gap-1">
            <MessageCircle size={10} /> Note from client
          </p>
          <p className="text-sm whitespace-pre-wrap">{check.client_note}</p>
        </div>
      )}

      {videoSrc ? (
        <video
          src={videoSrc}
          controls
          className="w-full rounded-lg max-h-[400px]"
        />
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Video unavailable.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={check.status === "reviewed" ? "outline" : "default"}
          onClick={toggleReviewed}
          disabled={saving}
          className="gap-2"
        >
          <CheckCircle2 size={14} />
          {saving
            ? "…"
            : check.status === "reviewed"
              ? "Mark as pending again"
              : "Mark as reviewed"}
        </Button>
        {check.archived_as_progress ? (
          <Button
            size="sm"
            variant="outline"
            onClick={unarchive}
            disabled={saving}
            className="gap-2 text-amber-700 border-amber-200 bg-amber-50"
          >
            <Archive size={14} />
            Archived (remove)
          </Button>
        ) : (
          !archiveFormOpen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setArchiveFormOpen(true)}
              disabled={saving}
              className="gap-2"
            >
              <Archive size={14} />
              Archive as progress
            </Button>
          )
        )}
      </div>

      {archiveFormOpen && !check.archived_as_progress && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <label className="text-xs font-semibold text-amber-800 uppercase tracking-wide block">
            Short description (what's this progress about?)
          </label>
          <Input
            value={archiveNote}
            onChange={(e) => setArchiveNote(e.target.value)}
            placeholder="e.g. Handstand: first 5 sec freestanding hold"
            maxLength={200}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={archive}
              disabled={saving}
              className="gap-1.5"
            >
              <Archive size={14} />
              {saving ? "Saving…" : "Archive"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setArchiveFormOpen(false);
                setArchiveNote(check.archived_note ?? "");
              }}
              disabled={saving}
              className="gap-1.5"
            >
              <X size={14} /> Cancel
            </Button>
          </div>
        </div>
      )}

      {check.archived_as_progress && check.archived_note && (
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <Archive size={10} className="inline mr-1" />
          Archived as: <span className="font-semibold">{check.archived_note}</span>
        </p>
      )}

      <p className="text-[11px] text-muted-foreground mt-2">
        Use the comment thread below to reply to the client.
      </p>

      {check.item_id && (
        <div className="mt-4 pt-3 border-t border-border">
          <ExerciseComments itemId={check.item_id} />
        </div>
      )}
    </div>
  );
};

export default AdminFormChecks;
