import { useEffect, useRef, useState, FormEvent } from "react";
import { ImagePlus, Loader2, MessageCircle, Send, Trash2, Wand2, X } from "lucide-react";
import {
  sbGet,
  sbPost,
  sbPatch,
  sbDelete,
  sbSignUrl,
} from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTouchInput } from "@/hooks/use-mobile";
import { rewriteComment, sendPush } from "@/integrations/supabase/notify";
import { notificationCopy } from "@/lib/notification-copy";

type Comment = {
  id: string;
  item_id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  /** Storage path in `comment-images`, not a URL: the bucket is private
   *  and every display goes through a signed link. */
  image_url: string | null;
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

/** Whose thread this is.
 *
 *  The screen that owns it usually knows and passes `clientId`. When it
 *  doesn't, the exercise itself says so: item -> week -> program ->
 *  assigned client. Both the push and the image folder need this answer,
 *  which is why it lives on its own.
 */
async function resolveThreadClient(
  itemId: string,
  clientId: string | null | undefined
): Promise<string | null> {
  if (clientId) return clientId;
  const rows = await sbGet<
    { program_weeks?: { programs?: { assigned_client_id?: string } } }[]
  >(
    `program_items?id=eq.${itemId}&select=program_weeks(programs(assigned_client_id))&limit=1`
  );
  return rows[0]?.program_weeks?.programs?.assigned_client_id ?? null;
}

/** Push the coach's feedback to the client's phone.
 *
 *  Silent-failure throughout: the comment is already posted and visible,
 *  and a phone that cannot be reached must not look like a failed reply.
 */
async function notifyClientOfComment(
  itemId: string,
  clientId: string | null | undefined
) {
  try {
    const recipient = await resolveThreadClient(itemId, clientId);
    if (!recipient) return;
    await sendPush(
      recipient,
      notificationCopy.comment.title,
      notificationCopy.comment.body,
      "/app/inbox",
      "comment"
    );
  } catch (e) {
    console.error("could not push the comment", e);
  }
}

// Upsert the current user's last_read_at for this item using ON CONFLICT.
// Goes through sbPost so an expired token gets refreshed + retried.
async function markRead(userId: string, itemId: string) {
  try {
    await sbPost(
      "comment_reads?on_conflict=user_id,item_id",
      {
        user_id: userId,
        item_id: itemId,
        last_read_at: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("markRead", e);
  }
}

const MAX_IMAGE_MB = 10;

/** Put one image in the private `comment-images` bucket and hand back
 *  its storage path.
 *
 *  `folder` is the CLIENT of the thread, never the uploader: the bucket
 *  policy grants a client read access to their own folder, so filing the
 *  coach's picture under the coach would leave the client unable to see
 *  the very thing that was sent to them.
 */
async function uploadCommentImage(file: File, folder: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const token = getToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/comment-images/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "x-upsert": "false",
      },
      body: file,
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return path;
}

/** The picture attached to a comment, shown inline at a size that reads
 *  on a phone. Tapping opens the full-resolution file, which is what a
 *  client does with an annotated position. */
const CommentImage = ({ src }: { src: string | undefined }) => {
  if (!src) return null;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block mt-2">
      <img
        src={src}
        alt="Attached"
        className="rounded-md border border-border max-h-72 w-auto"
        loading="lazy"
      />
    </a>
  );
};

/**
 * Per-exercise discussion thread.
 *
 * `readOnly` flips the component into archive mode: no compose form,
 * no delete buttons, no toggle. The thread stays open so the coaching
 * history can be skimmed like a transcript. Used on archived programs
 * to keep the past consultable but immutable.
 *
 * `previewLastOnly` is the workout-page mode: thread stays collapsed,
 * but the most recent message is shown inline as a preview so the
 * client lands on the latest coach feedback they need to apply
 * without scrolling through the full history. The toggle still
 * exposes the rest of the conversation on demand.
 *
 * `onReplied` lets the parent refetch its own state after the coach
 * (or client) posts a comment — needed because a coach reply also
 * auto-marks pending form checks as reviewed, and the inbox upstream
 * has to re-read to drop the entry that no longer applies.
 */
const ExerciseComments = ({
  itemId,
  readOnly = false,
  previewLastOnly = false,
  onReplied,
  clientId,
}: {
  itemId: string;
  readOnly?: boolean;
  previewLastOnly?: boolean;
  onReplied?: () => void;
  /** Whose thread this is. Only used to pick the language the rewrite
   *  comes back in; without it the assistant defaults to English. */
  clientId?: string | null;
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
  const [rewriting, setRewriting] = useState(false);
  // Keeps the draft as typed so one click can put it back: the rewrite
  // is a suggestion, and changing your mind should not mean retyping.
  const [beforeRewrite, setBeforeRewrite] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  // Attachment being composed: the file itself, plus a local object URL
  // so the sender sees what they picked before it leaves the phone.
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(
    null
  );
  const [sendError, setSendError] = useState<string | null>(null);
  // Signed links for the images already in the thread, keyed by comment
  // id. The bucket is private, so nothing renders without one.
  const [signed, setSigned] = useState<Record<string, string>>({});
  const imageInput = useRef<HTMLInputElement>(null);
  const touchInput = useTouchInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // When set, focus the textarea on the next render that has it
  // mounted. We can't focus directly inside the click handler because
  // the textarea is rendered conditionally on `open`.
  const focusOnOpenRef = useRef(false);

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

      // Sign the attachments in parallel: a thread with a handful of
      // pictures should not open one round-trip at a time.
      const withImages = rows.filter((r) => r.image_url);
      if (withImages.length) {
        const pairs = await Promise.all(
          withImages.map(
            async (r) =>
              [r.id, await sbSignUrl("comment-images", r.image_url!)] as const
          )
        );
        setSigned((prev) => {
          const next = { ...prev };
          for (const [id, url] of pairs) if (url) next[id] = url;
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    setSendError(null);
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setSendError(`Image too large. Max ${MAX_IMAGE_MB} MB.`);
      return;
    }
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  };

  const clearPending = () => {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
    if (imageInput.current) imageInput.current.value = "";
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
  // In preview mode we keep the thread collapsed and rely on the
  // preview card below to surface the latest message instead.
  useEffect(() => {
    if (previewLastOnly) return;
    if (loaded && !userToggled && comments.length > 0) {
      setOpen(true);
    }
  }, [loaded, comments.length, userToggled, previewLastOnly]);

  // Land the cursor in the compose field as soon as the user clicks
  // Reply, so they can type without an extra click.
  useEffect(() => {
    if (open && focusOnOpenRef.current && textareaRef.current) {
      textareaRef.current.focus();
      focusOnOpenRef.current = false;
    }
  }, [open]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    // A picture on its own is a complete message here: "look at this
    // frame" needs no caption to be understood.
    if ((!trimmed && !pending) || !user || !profile) return;
    setSendError(null);

    // Optimistic update: the comment lands in the thread instantly.
    // The form clears, the user sees their message right away, and
    // every network call runs in the background. If the POST fails
    // we roll back and put the text back in the input so they can
    // retry without retyping.
    const attachment = pending;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      item_id: itemId,
      author_id: user.id,
      author_role: profile.role,
      body: trimmed,
      image_url: attachment ? "pending" : null,
      parent_id: null,
      created_at: new Date().toISOString(),
      profiles: {
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    };
    setComments((cs) => [...cs, optimistic]);
    // The local preview stands in for the signed link until the real
    // one comes back with the reload.
    if (attachment) setSigned((s) => ({ ...s, [tempId]: attachment.preview }));
    setBody("");
    setPending(null);
    if (imageInput.current) imageInput.current.value = "";
    setSending(true);

    try {
      let imagePath: string | null = null;
      if (attachment) {
        // Whoever sends it, the file is filed under the client, so the
        // client can read it back.
        const folder =
          profile.role === "coach"
            ? await resolveThreadClient(itemId, clientId)
            : user.id;
        if (!folder) throw new Error("Could not tell whose thread this is");
        imagePath = await uploadCommentImage(attachment.file, folder);
      }
      await sbPost("exercise_comments", {
        item_id: itemId,
        author_id: user.id,
        author_role: profile.role,
        body: trimmed,
        image_url: imagePath,
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

        // Ring the client's phone. Feedback is the whole point of the
        // thread, and until now it waited for them to come looking:
        // comments have their own unread system and never touched the
        // `notifications` table, so nothing ever pushed.
        void notifyClientOfComment(itemId, clientId);
      }
      markRead(user.id, itemId);
      // Replace the temp row with the canonical one from the server.
      await load();
      if (attachment) {
        URL.revokeObjectURL(attachment.preview);
        setSigned(({ [tempId]: _dropped, ...rest }) => rest);
      }
      // Let the parent inbox refetch so the resolved entry drops out.
      onReplied?.();
    } catch (e) {
      console.error(e);
      setComments((cs) => cs.filter((c) => c.id !== tempId));
      setBody(trimmed);
      // Hand the picture back rather than making them find it again.
      if (attachment) setPending(attachment);
      setSendError(
        attachment ? "Could not send the image. Try again." : "Could not send."
      );
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const target = comments.find((c) => c.id === id);
    try {
      await sbDelete(`exercise_comments?id=eq.${id}`);
      setComments((cs) => cs.filter((c) => c.id !== id));
      // Take the file with the message. Best-effort: the comment is
      // already gone, and an orphaned object must not look like a
      // failed delete.
      if (target?.image_url) {
        const token = getToken();
        if (token) {
          void fetch(
            `${SUPABASE_URL}/storage/v1/object/comment-images/${target.image_url}`,
            {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${token}`,
              },
            }
          ).catch(() => {});
        }
      }
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
              {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
              <CommentImage src={signed[c.id]} />
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
          // Opening = the user wants to type. Closing = no focus
          // request needed.
          if (!open) focusOnOpenRef.current = true;
          setOpen(!open);
        }}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 relative"
      >
        <MessageCircle size={12} />
        {open ? "Hide" : "Add a comment"}
        {!open && unread > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread}
          </span>
        )}
      </button>

      {/* Latest-message preview when collapsed in preview mode. The
          client lands on the most recent feedback to apply without
          having to expand the whole conversation. */}
      {previewLastOnly && !open && loaded && comments.length > 0 && (() => {
        const last = comments[comments.length - 1];
        const name =
          last.profiles?.first_name ??
          (last.author_role === "coach" ? "Coach" : "Client");
        return (
          <div
            className={`mt-2 text-xs rounded-md px-3 py-2 border ${
              last.author_role === "coach"
                ? "bg-accent/5 border-accent/20"
                : "bg-muted/40 border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">
                {name}
                <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                  {last.author_role}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(last.created_at).toLocaleString("en-US", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {last.body && (
              <p className="whitespace-pre-wrap">{last.body}</p>
            )}
            <CommentImage src={signed[last.id]} />
          </div>
        );
      })()}

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
                {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
                <CommentImage src={signed[c.id]} />
              </div>
            );
          })}

          {/* Coach only: the client writes in their own language and has
              nothing to clean up. Sits above the field so the result is
              read before sending, never sent on its behalf. */}
          {profile?.role === "coach" && !readOnly && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  const draft = body.trim();
                  if (!draft || rewriting) return;
                  setRewriting(true);
                  setRewriteError(null);
                  const res = await rewriteComment(draft, clientId);
                  setRewriting(false);
                  if (!res.ok || !res.text) {
                    setRewriteError(res.error || "Rewrite failed");
                    return;
                  }
                  setBeforeRewrite(draft);
                  setBody(res.text);
                }}
                disabled={!body.trim() || rewriting || sending}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-border rounded-full px-2.5 py-1 disabled:opacity-40"
                title="Clean up this draft in the client's language"
              >
                <Wand2 size={12} />
                {rewriting ? "Rewriting…" : "Clean up"}
              </button>
              {beforeRewrite !== null && !rewriting && (
                <button
                  type="button"
                  onClick={() => {
                    setBody(beforeRewrite);
                    setBeforeRewrite(null);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  Undo
                </button>
              )}
              {rewriteError && (
                <span className="text-[11px] text-red-700">{rewriteError}</span>
              )}
            </div>
          )}

          {/* What is about to be sent, and why it might not have been.
              Shown above the field so it is read before the send. */}
          {(pending || sendError) && (
            <div className="pt-1">
              {pending && (
                <div className="relative inline-block">
                  <img
                    src={pending.preview}
                    alt="To send"
                    className="rounded-md border border-border max-h-32 w-auto"
                  />
                  <button
                    type="button"
                    onClick={clearPending}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-foreground text-white p-1"
                    title="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
              {sendError && (
                <p className="text-[11px] text-red-700 mt-1">{sendError}</p>
              )}
            </div>
          )}

          <form onSubmit={send} className="flex gap-2 pt-1">
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                // With a real keyboard, Enter sends and Shift+Enter adds a
                // newline. On a touch keyboard that shortcut has no escape
                // hatch (there is no Shift to hold), so Enter behaves the
                // way every messaging app does: it breaks the line, and the
                // send button sends.
                if (touchInput) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if ((body.trim() || pending) && !sending) {
                    void send(e as unknown as FormEvent);
                  }
                }
              }}
              placeholder={
                touchInput
                  ? "Write a comment…"
                  : "Write a comment…  (Shift+Enter for new line)"
              }
              rows={2}
              className="text-xs flex-1"
            />
            <div className="flex gap-1 self-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => imageInput.current?.click()}
                disabled={sending}
                title="Attach an image"
              >
                <ImagePlus size={14} />
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sending || (!body.trim() && !pending)}
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ExerciseComments;
