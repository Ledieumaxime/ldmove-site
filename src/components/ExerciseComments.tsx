import { useEffect, useState, FormEvent } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { sbGet, sbPost, sbPatch, sbDelete } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Comment = {
  id: string;
  item_id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  parent_id: string | null;
  created_at: string;
  profiles?: { first_name: string | null; last_name: string | null } | null;
};

type Read = { user_id: string; item_id: string; last_read_at: string };

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

// Upsert the current user's last_read_at for this item using ON CONFLICT.
async function markRead(userId: string, itemId: string) {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/comment_reads?on_conflict=user_id,item_id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        item_id: itemId,
        last_read_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) console.error("markRead failed", res.status, await res.text());
  } catch (e) {
    console.error("markRead", e);
  }
}

/**
 * Per-exercise discussion thread.
 *
 * `readOnly` flips the component into archive mode: no compose form,
 * no delete buttons, no toggle. The thread stays open so the coaching
 * history can be skimmed like a transcript. Used on archived programs
 * to keep the past consultable but immutable.
 *
 * `onReplied` lets the parent refetch its own state after the coach
 * (or client) posts a comment — needed because a coach reply also
 * auto-marks pending form checks as reviewed, and the inbox upstream
 * has to re-read to drop the entry that no longer applies.
 */
const ExerciseComments = ({
  itemId,
  readOnly = false,
  onReplied,
}: {
  itemId: string;
  readOnly?: boolean;
  onReplied?: () => void;
}) => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(readOnly);
  const [userToggled, setUserToggled] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, reads] = await Promise.all([
        sbGet<Comment[]>(
          `exercise_comments?item_id=eq.${itemId}&select=*,profiles(first_name,last_name)&order=created_at.asc`
        ),
        user
          ? sbGet<Read[]>(
              `comment_reads?user_id=eq.${user.id}&item_id=eq.${itemId}&select=last_read_at&limit=1`
            )
          : Promise.resolve([] as Read[]),
      ]);
      setComments(rows);
      setLastReadAt(reads[0]?.last_read_at ?? null);
      setLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Always reload on open (so new messages show up) AND mark as read.
  useEffect(() => {
    if (open) {
      (async () => {
        await load();
        if (user) await markRead(user.id, itemId);
        setLastReadAt(new Date().toISOString());
      })();
    } else if (!loaded) {
      // Quick pre-load to know if there are unread ones (for the red dot)
      load();
    }
  }, [open]);

  // Auto-open once we know there are existing comments, so the thread is
  // visible in a single click. The user can still collapse manually.
  useEffect(() => {
    if (loaded && !userToggled && comments.length > 0) {
      setOpen(true);
    }
  }, [loaded, comments.length, userToggled]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !user || !profile) return;

    // Optimistic update: the comment lands in the thread instantly.
    // The form clears, the user sees their message right away, and
    // every network call runs in the background. If the POST fails
    // we roll back and put the text back in the input so they can
    // retry without retyping.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      item_id: itemId,
      author_id: user.id,
      author_role: profile.role,
      body: trimmed,
      parent_id: null,
      created_at: new Date().toISOString(),
      profiles: {
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    };
    setComments((cs) => [...cs, optimistic]);
    setBody("");
    setSending(true);

    try {
      await sbPost("exercise_comments", {
        item_id: itemId,
        author_id: user.id,
        author_role: profile.role,
        body: trimmed,
      });
      setSending(false);

      // The slower follow-up writes don't block the UI: the comment
      // is already on screen, the user has moved on.
      if (profile.role === "coach") {
        // Replying as the coach IS the review for any pending form
        // check on this exercise — flip them to reviewed in one shot
        // so the inbox doesn't surface the same exercise twice.
        sbPatch(
          `form_check_submissions?item_id=eq.${itemId}&status=eq.pending`,
          {
            status: "reviewed",
            reviewed_at: new Date().toISOString(),
          }
        ).catch(() => {
          // Non-fatal: comment is posted, coach can mark manually if
          // the auto-update silently failed.
        });
      }
      markRead(user.id, itemId);
      // Replace the temp row with the canonical one from the server.
      load();
      // Let the parent inbox refetch so the resolved entry drops out.
      onReplied?.();
    } catch (e) {
      console.error(e);
      setComments((cs) => cs.filter((c) => c.id !== tempId));
      setBody(trimmed);
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await sbDelete(`exercise_comments?id=eq.${id}`);
      setComments((cs) => cs.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Compute unread count (comments by the OTHER party created after last_read_at)
  const unread = comments.filter((c) => {
    if (c.author_id === user?.id) return false;
    if (!lastReadAt) return true;
    return new Date(c.created_at).getTime() > new Date(lastReadAt).getTime();
  }).length;

  const count = comments.length;

  // In archive mode the thread is just static reading material:
  // no toggle, no delete, no compose. We also skip rendering anything
  // when there's nothing to read so an empty exercise stays clean.
  if (readOnly) {
    if (loaded && comments.length === 0) return null;
    return (
      <div className="border-t border-border mt-2 pt-2 space-y-2">
        {loading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {comments.map((c) => {
          const name =
            c.profiles?.first_name ??
            (c.author_role === "coach" ? "Coach" : "Client");
          return (
            <div
              key={c.id}
              className={`text-xs rounded-md px-3 py-2 border ${
                c.author_role === "coach"
                  ? "bg-accent/5 border-accent/20"
                  : "bg-muted/40 border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">
                  {name}
                  <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                    {c.author_role}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("en-US", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border-t border-border mt-2 pt-2">
      <button
        type="button"
        onClick={() => {
          setUserToggled(true);
          setOpen(!open);
        }}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 relative"
      >
        <MessageCircle size={12} />
        {open ? "Hide" : loaded && count > 0 ? `${count} comment${count > 1 ? "s" : ""}` : "Comment"}
        {!open && unread > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No comments yet.</p>
          )}
          {comments.map((c) => {
            const isMine = c.author_id === user?.id;
            const name =
              c.profiles?.first_name ?? (c.author_role === "coach" ? "Coach" : "Client");
            return (
              <div
                key={c.id}
                className={`text-xs rounded-md px-3 py-2 border ${
                  c.author_role === "coach"
                    ? "bg-accent/5 border-accent/20"
                    : "bg-muted/40 border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">
                    {name}
                    <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                      {c.author_role}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("en-US", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMine && (
                      <button
                        onClick={() => remove(c.id)}
                        className="text-muted-foreground hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            );
          })}

          <form onSubmit={send} className="flex gap-2 pt-1">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a comment…"
              rows={2}
              className="text-xs flex-1"
            />
            <Button type="submit" size="sm" disabled={sending || !body.trim()} className="self-end">
              <Send size={14} />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ExerciseComments;
