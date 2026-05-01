import { useRef, useState } from "react";
import { Video, X, CheckCircle2, Loader2, Camera, Upload } from "lucide-react";
import { sbPost } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Action-only upload UI for the client. When the client opens the
 * panel they get straight to the choice "Record now / Upload file".
 * We deliberately don't list previously sent videos here — that
 * history lives in the coach's Inbox and in the comments thread, and
 * surfacing it on every exercise was cluttering the workflow.
 */

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

const FormCheckUpload = ({ itemId }: { itemId: string }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

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

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/form-checks/${path}`);
        xhr.setRequestHeader("apikey", SUPABASE_KEY);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      await sbPost("form_check_submissions", {
        item_id: itemId,
        client_id: user.id,
        video_url: path,
        status: "pending",
      });

      // Brief confirmation, then collapse the panel back to its
      // resting state so the workflow stays uncluttered.
      setJustSent(true);
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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <Video size={12} />
        {open ? "Hide" : "Send a form check"}
      </button>

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
    </div>
  );
};

export default FormCheckUpload;
