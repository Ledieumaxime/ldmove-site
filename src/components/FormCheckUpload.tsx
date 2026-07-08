import { useRef, useState } from "react";
import {
  Video,
  X,
  CheckCircle2,
  Loader2,
  Camera,
  Upload,
  Trash2,
} from "lucide-react";
import { sbDelete, sbGet, sbPost, sbSignUrl } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Action-first upload UI for the client.
 *
 * Default open state shows the two upload paths (Record / Upload).
 * Past videos for this exercise stay in the database but are not
 * rendered by default — surfacing them on every exercise was
 * cluttering the workout page. A discreet "View past videos" link
 * lets the client load and skim them on demand.
 */

type FormCheck = {
  id: string;
  item_id: string | null;
  client_id: string;
  video_url: string | null;
  client_note: string | null;
  reviewed_at: string | null;
  status: "pending" | "reviewed";
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";
const MAX_SIZE_MB = 100;
const SUCCESS_FLASH_MS = 4000;

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

// Force a fresh access token from the stored refresh_token and persist
// it back to localStorage. Returns the new access token (or null if it
// failed). Used to recover from a 401/403 'JWT expired' / 'claim
// timestamp check failed' during upload without making the client sign
// out and back in.
async function refreshToken(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.refresh_token) return null;
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const next = {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? session.refresh_token,
      expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      user: session.user,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return json.access_token as string;
  } catch {
    return null;
  }
}

// Shared helper — refreshes an expired token and retries, instead of
// silently returning null (which hid past videos from the client).
const signUrl = (path: string) => sbSignUrl("form-checks", path);

const FormCheckUpload = ({ itemId }: { itemId: string }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  // History is opt-in: stays hidden until the client asks for it.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyChecks, setHistoryChecks] = useState<FormCheck[]>([]);
  const [historySigned, setHistorySigned] = useState<Record<string, string>>(
    {}
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const rows = await sbGet<FormCheck[]>(
        `form_check_submissions?item_id=eq.${itemId}&client_id=eq.${user.id}&order=created_at.desc`
      );
      setHistoryChecks(rows);
      // Sign URLs in parallel so a long history doesn't drag the
      // expand into a multi-second wait.
      const withVideos = rows.filter((r) => r.video_url);
      const signed = await Promise.all(
        withVideos.map(
          async (r) => [r.id, await signUrl(r.video_url!)] as const
        )
      );
      const sigs: Record<string, string> = {};
      for (const [id, url] of signed) if (url) sigs[id] = url;
      setHistorySigned(sigs);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    if (!historyOpen) loadHistory();
    setHistoryOpen((v) => !v);
  };

  const removeFromHistory = async (c: FormCheck) => {
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    try {
      if (c.video_url) {
        const token = getToken();
        if (token) {
          await fetch(
            `${SUPABASE_URL}/storage/v1/object/form-checks/${c.video_url}`,
            {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${token}`,
              },
            }
          );
        }
      }
      await sbDelete(`form_check_submissions?id=eq.${c.id}`);
      setHistoryChecks((cs) => cs.filter((x) => x.id !== c.id));
    } catch (e) {
      console.error(e);
      setError("Failed to delete video.");
    }
  };

  const upload = async (file: File) => {
    if (!user) return;
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      let token = getToken();
      if (!token) throw new Error("Not signed in");

      // Try the upload; on an auth-timestamp failure (401/403) refresh
      // the token once and retry. Covers expired or skewed tokens
      // without forcing a full sign-out.
      const doUpload = (authToken: string) =>
        new Promise<{ status: number; body: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `${SUPABASE_URL}/storage/v1/object/form-checks/${path}`
          );
          xhr.setRequestHeader("apikey", SUPABASE_KEY);
          xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
          xhr.setRequestHeader("x-upsert", "false");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () =>
            resolve({ status: xhr.status, body: xhr.responseText });
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

      let result = await doUpload(token);
      if (result.status === 401 || result.status === 403) {
        const fresh = await refreshToken();
        if (fresh) {
          token = fresh;
          setProgress(0);
          result = await doUpload(fresh);
        }
      }
      if (result.status >= 300) {
        // Give a human hint for the most common residual cause: a phone
        // clock that's off enough to trip the JWT timestamp check.
        if (
          result.status === 403 &&
          /timestamp/i.test(result.body)
        ) {
          throw new Error(
            "Upload rejected (clock check). Please check your phone's Date & Time is set to Automatic, then try again."
          );
        }
        throw new Error(result.body || `Upload failed (${result.status})`);
      }

      await sbPost("form_check_submissions", {
        item_id: itemId,
        client_id: user.id,
        video_url: path,
        status: "pending",
      });

      setJustSent(true);
      // Drop the cached history so the next time the client opens
      // it, the brand-new submission shows up.
      setHistoryOpen(false);
      setHistoryChecks([]);
      setHistorySigned({});
      setTimeout(() => {
        setJustSent(false);
        setOpen(false);
      }, SUCCESS_FLASH_MS);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = "";
  };

  return (
    <div className="border-t border-border mt-2 pt-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Video size={12} />
          {open ? "Hide" : "Send a form check"}
        </button>
        <button
          type="button"
          onClick={toggleHistory}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Video size={12} />
          {historyOpen ? "Hide past videos" : "View past videos"}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-3">
          {justSent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 inline-flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>Sent. Your coach will review it shortly.</span>
            </div>
          ) : uploading ? (
            <div className="bg-white border border-border rounded-lg p-3 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={14} className="animate-spin text-accent" />
                <span>Uploading… {progress}%</span>
              </div>
              <div className="h-1 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={camInput}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  onChange={onFile}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => camInput.current?.click()}
                  className="text-xs gap-1.5"
                >
                  <Camera size={14} /> Record now
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={onFile}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  className="text-xs gap-1.5"
                >
                  <Upload size={14} /> Upload file
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Max {MAX_SIZE_MB} MB. MP4 / MOV / WebM. Use the comments
                below to add context.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex items-start gap-2">
              <X size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {historyOpen && (
        <div className="mt-2 space-y-2">
          {historyLoading && (
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </p>
          )}
          {!historyLoading && historyChecks.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">
              No past videos for this exercise.
            </p>
          )}
          {historyChecks.map((c) => (
            <div
              key={c.id}
              className={`border rounded-lg p-3 text-xs ${
                c.status === "reviewed"
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-semibold">
                  {c.status === "reviewed" ? (
                    <span className="text-green-700 inline-flex items-center gap-1">
                      <CheckCircle2 size={12} /> Reviewed
                    </span>
                  ) : (
                    <span className="text-amber-700">Awaiting review</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-US")}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromHistory(c)}
                    aria-label="Delete video"
                    title="Delete video"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {c.client_note && (
                <p className="mb-1 italic">Your note: {c.client_note}</p>
              )}
              {historySigned[c.id] && (
                <video
                  src={historySigned[c.id]}
                  controls
                  preload="metadata"
                  className="w-full rounded mt-1"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormCheckUpload;
