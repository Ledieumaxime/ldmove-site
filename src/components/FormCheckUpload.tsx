import { useEffect, useRef, useState } from "react";
import { Video, X, CheckCircle2, Loader2, Trash2, Camera, Upload } from "lucide-react";
import { sbGet, sbPost, sbDelete } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type FormCheck = {
  id: string;
  item_id: string | null;
  client_id: string;
  video_url: string | null;
  client_note: string | null;
  coach_feedback: string | null;
  reviewed_at: string | null;
  status: "pending" | "reviewed";
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";
const MAX_SIZE_MB = 100;

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

const FormCheckUpload = ({ itemId }: { itemId: string }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    try {
      const rows = await sbGet<FormCheck[]>(
        `form_check_submissions?item_id=eq.${itemId}&client_id=eq.${user.id}&order=created_at.desc`
      );
      setChecks(rows);
      setLoaded(true);
      // Sign URLs for each video
      const sigs: Record<string, string> = {};
      for (const r of rows) {
        if (r.video_url) {
          const s = await signUrl(r.video_url);
          if (s) sigs[r.id] = s;
        }
      }
      setSignedUrls(sigs);
    } catch (e) {
      console.error(e);
    }
  };

  // Always refresh when the panel opens (so new coach feedback shows up)
  useEffect(() => {
    if (open) load();
  }, [open]);

  const signUrl = async (path: string): Promise<string | null> => {
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
      const token = getToken();
      if (!token) throw new Error("Not signed in");

      // Upload to storage
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/form-checks/${path}`);
        xhr.setRequestHeader("apikey", SUPABASE_KEY);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      // Create DB row
      await sbPost("form_check_submissions", {
        item_id: itemId,
        client_id: user.id,
        video_url: path,
        status: "pending",
      });

      await load();
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

  const remove = async (check: FormCheck) => {
    if (!window.confirm("Delete this form check video? This cannot be undone.")) return;
    setError(null);
    try {
      if (check.video_url) {
        const token = getToken();
        if (token) {
          await fetch(
            `${SUPABASE_URL}/storage/v1/object/form-checks/${check.video_url}`,
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
      await sbDelete(`form_check_submissions?id=eq.${check.id}`);
      await load();
    } catch (e) {
      console.error(e);
      setError("Failed to delete video. Please try again.");
    }
  };

  const count = checks.length;

  return (
    <div className="border-t border-border mt-2 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <Video size={12} />
        {open
          ? "Hide form check"
          : loaded && count > 0
          ? `${count} form check${count > 1 ? "s" : ""} sent`
          : "Send a form check"}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {/* Existing submissions */}
          {checks.map((c) => (
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
                    onClick={() => remove(c)}
                    aria-label="Delete video"
                    title="Delete video"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {c.client_note && <p className="mb-1 italic">Your note: {c.client_note}</p>}
              {signedUrls[c.id] && (
                <video src={signedUrls[c.id]} controls className="w-full rounded mt-1" />
              )}
              {c.status === "reviewed" && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Your coach reviewed it — check the comments below for the reply.
                </p>
              )}
            </div>
          ))}

          {/* Upload form */}
          {uploading ? (
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
                Max {MAX_SIZE_MB} MB. MP4 / MOV / WebM. Use the comments below to add context.
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
    </div>
  );
};

export default FormCheckUpload;
