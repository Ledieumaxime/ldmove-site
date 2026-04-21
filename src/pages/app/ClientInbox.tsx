import { useEffect, useLayoutEffect, useState } from "react";
import { MessageCircle, Video, CheckCircle2, User, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import ExerciseComments from "@/components/ExerciseComments";

type Comment = {
  id: string;
  item_id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  program_items?: { custom_name: string | null } | null;
};

type Read = { item_id: string; last_read_at: string };

type FormCheck = {
  id: string;
  item_id: string | null;
  video_url: string | null;
  status: "pending" | "reviewed";
  created_at: string;
  reviewed_at: string | null;
  program_items?: { custom_name: string | null } | null;
};

type Thread = {
  item_id: string;
  exerciseName: string;
  lastBody: string;
  lastAt: string;
  lastRole: "coach" | "client";
  count: number;
  hasUnreadFromCoach: boolean;
};

const ClientInbox = () => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [c, r, f] = await Promise.all([
        sbGet<Comment[]>(
          "exercise_comments?select=*,program_items(custom_name)&order=created_at.desc&limit=200"
        ),
        sbGet<Read[]>(
          `comment_reads?select=item_id,last_read_at&user_id=eq.${user.id}`
        ),
        sbGet<FormCheck[]>(
          `form_check_submissions?select=*,program_items(custom_name)&client_id=eq.${user.id}&order=created_at.desc`
        ),
      ]);
      setComments(c);
      setReads(r);
      setChecks(f);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

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

  const readsByItem = new Map(reads.map((r) => [r.item_id, r.last_read_at]));

  // Group comments by item, compute unread-from-coach flag
  const byItem = new Map<string, Comment[]>();
  for (const c of comments) {
    if (!byItem.has(c.item_id)) byItem.set(c.item_id, []);
    byItem.get(c.item_id)!.push(c);
  }
  const threads: Thread[] = [];
  for (const [item_id, cs] of byItem) {
    const lastRead = readsByItem.get(item_id);
    const lastReadTs = lastRead ? new Date(lastRead).getTime() : 0;
    const hasUnreadFromCoach = cs.some(
      (c) =>
        c.author_role === "coach" &&
        new Date(c.created_at).getTime() > lastReadTs
    );
    const last = cs[0];
    threads.push({
      item_id,
      exerciseName: last?.program_items?.custom_name ?? "Exercise",
      lastBody: last?.body ?? "",
      lastAt: last?.created_at ?? "",
      lastRole: last?.author_role ?? "client",
      count: cs.length,
      hasUnreadFromCoach,
    });
  }
  threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  const unreadThreads = threads.filter((t) => t.hasUnreadFromCoach);
  const readThreads = threads.filter((t) => !t.hasUnreadFromCoach);

  const pendingChecks = checks.filter((c) => c.status === "pending");
  const reviewedChecks = checks.filter((c) => c.status === "reviewed");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          Messages from your coach and your form check videos.
        </p>
      </div>

      {/* === MESSAGES === */}
      <section id="messages" className="space-y-3 scroll-mt-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-accent" />
          <h2 className="font-heading text-2xl font-bold">Messages</h2>
          {unreadThreads.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full bg-red-500 text-white text-xs font-bold">
              {unreadThreads.length}
            </span>
          )}
        </div>

        {unreadThreads.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-white border border-border rounded-xl p-5">
            No unread messages from your coach.
          </p>
        ) : (
          <div className="space-y-3">
            {unreadThreads.map((t) => (
              <ThreadCard key={t.item_id} thread={t} highlight />
            ))}
          </div>
        )}
      </section>

      {/* === FORM CHECKS === */}
      <section id="form-checks" className="space-y-3 scroll-mt-4">
        <div className="flex items-center gap-2">
          <Video size={20} className="text-accent" />
          <h2 className="font-heading text-2xl font-bold">Your form checks</h2>
          {pendingChecks.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full bg-amber-500 text-white text-xs font-bold">
              {pendingChecks.length} pending
            </span>
          )}
        </div>

        {pendingChecks.length === 0 && reviewedChecks.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-white border border-border rounded-xl p-5">
            You haven't sent any form check yet. Use the "Send a form check" button under an exercise.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingChecks.map((c) => (
              <FormCheckClientCard key={c.id} check={c} />
            ))}
            {reviewedChecks.map((c) => (
              <FormCheckClientCard key={c.id} check={c} />
            ))}
          </div>
        )}
      </section>

      {/* === ARCHIVED (read threads) === */}
      {readThreads.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="inline-flex items-center gap-2 hover:text-accent"
          >
            <CheckCircle2 size={20} className="text-muted-foreground" />
            <h2 className="font-heading text-2xl font-bold">
              Read ({readThreads.length})
            </h2>
            {showArchived ? (
              <ChevronUp size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </button>
          {showArchived && (
            <div className="space-y-3">
              {readThreads.map((t) => (
                <ThreadCard key={t.item_id} thread={t} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const ThreadCard = ({
  thread,
  highlight = false,
}: {
  thread: Thread;
  highlight?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        highlight ? "border-red-200" : "border-border"
      }`}
    >
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-muted-foreground shrink-0" />
              <span className="font-semibold">
                {thread.lastRole === "coach" ? "Coach" : "You"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground truncate">
                {thread.exerciseName?.replace(/^\[[^\]]+\]\s*/, "")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 truncate">"{thread.lastBody}"</p>
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

const FormCheckClientCard = ({ check }: { check: FormCheck; videoSrc?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        check.status === "pending" ? "border-amber-200" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {check.program_items?.custom_name?.replace(/^\[[^\]]+\]\s*/, "") ?? "Exercise"}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock size={11} />
            {new Date(check.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
            check.status === "pending"
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {check.status === "pending" ? "Awaiting review" : "Reviewed"}
        </span>
      </div>

      {check.item_id && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="mt-2 text-xs text-accent hover:underline"
          >
            {open ? "Hide" : "View"} coach reply
          </button>
          {open && (
            <div className="mt-2 pt-3 border-t border-border">
              <ExerciseComments itemId={check.item_id} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientInbox;
