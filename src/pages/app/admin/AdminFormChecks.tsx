import { useEffect, useState, useLayoutEffect } from "react";
import { Clock, User, CheckCircle2, MessageCircle, Video, ChevronDown, ChevronUp, Check, Archive, X } from "lucide-react";
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
  clientName: string;
  lastBody: string;
  lastAt: string;
  count: number;
  needsReply: boolean;
};

const AdminFormChecks = () => {
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);

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

      // Group comments by item_id. Since they arrive sorted desc, first in list = most recent.
      const byItem = new Map<string, CommentRow[]>();
      for (const c of allComments) {
        if (!byItem.has(c.item_id)) byItem.set(c.item_id, []);
        byItem.get(c.item_id)!.push(c);
      }
      const threadsOut: Thread[] = [];
      for (const [item_id, cs] of byItem) {
        const last = cs[0];
        // Find a client in the thread to get a display name
        const clientMsg = cs.find((c) => c.author_role === "client");
        threadsOut.push({
          item_id,
          exerciseName: cs[0]?.program_items?.custom_name ?? "Exercise",
          clientName: clientMsg?.profiles?.first_name ?? "Client",
          lastBody: last.body,
          lastAt: last.created_at,
          count: cs.length,
          needsReply: last.author_role === "client",
        });
      }
      threadsOut.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
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

  // Scroll to the section indicated by the URL hash (#comments or #form-checks)
  // once data is loaded and sections are rendered.
  useLayoutEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );

  const pendingChecks = checks.filter((c) => c.status === "pending");
  const reviewedChecks = checks.filter((c) => c.status === "reviewed");
  const unansweredThreads = threads.filter((t) => t.needsReply);
  const answeredThreads = threads.filter((t) => !t.needsReply);

  return (
    <div className="space-y-8">
      <BackToDashboard />
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          Client activity that needs your attention.
        </p>
      </div>

      {/* === COMMENTS === */}
      <section id="comments" className="space-y-3 scroll-mt-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-accent" />
          <h2 className="font-heading text-2xl font-bold">Comments</h2>
          {unansweredThreads.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full bg-red-500 text-white text-xs font-bold">
              {unansweredThreads.length}
            </span>
          )}
        </div>

        {unansweredThreads.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-white border border-border rounded-xl p-5">
            No client comments awaiting your reply.
          </p>
        ) : (
          <div className="space-y-3">
            {unansweredThreads.map((t) => (
              <ThreadCard key={t.item_id} thread={t} />
            ))}
          </div>
        )}
      </section>

      {/* === FORM CHECKS === */}
      <section id="form-checks" className="space-y-3 scroll-mt-4">
        <div className="flex items-center gap-2">
          <Video size={20} className="text-accent" />
          <h2 className="font-heading text-2xl font-bold">Form checks</h2>
          {pendingChecks.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full bg-red-500 text-white text-xs font-bold">
              {pendingChecks.length}
            </span>
          )}
        </div>

        {pendingChecks.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-white border border-border rounded-xl p-5">
            No pending videos.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingChecks.map((c) => (
              <CheckCard key={c.id} check={c} videoSrc={signedUrls[c.id]} onUpdated={load} />
            ))}
          </div>
        )}
      </section>

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
                      <CheckCard key={c.id} check={c} videoSrc={signedUrls[c.id]} onUpdated={load} />
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

const ThreadCard = ({ thread, compact = false }: { thread: Thread; compact?: boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        thread.needsReply ? "border-red-200" : "border-border"
      }`}
    >
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <User size={14} className="text-muted-foreground shrink-0" />
              <span className="font-semibold">{thread.clientName}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{thread.exerciseName}</span>
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
        reviewed_at: nextStatus === "reviewed" ? new Date().toISOString() : null,
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
            <User size={14} className="text-muted-foreground" />
            <span className="font-semibold">
              {check.profiles?.first_name} {check.profiles?.last_name}
            </span>
            <Clock size={12} className="text-muted-foreground ml-2" />
            <span className="text-xs text-muted-foreground">
              {new Date(check.created_at).toLocaleDateString("en-US")}
            </span>
          </div>
          {check.program_items?.custom_name && (
            <p className="text-xs text-muted-foreground mt-1">
              Exercise: {check.program_items.custom_name}
            </p>
          )}
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
        <video src={videoSrc} controls className="w-full rounded-lg max-h-[400px]" />
      ) : (
        <p className="text-xs text-muted-foreground italic">Video unavailable.</p>
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
            <Button size="sm" onClick={archive} disabled={saving} className="gap-1.5">
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
