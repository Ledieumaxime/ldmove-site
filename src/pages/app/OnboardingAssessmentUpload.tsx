import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  Play,
  RefreshCw,
  AlertCircle,
  Lock,
} from "lucide-react";
import { sbGet, sbPost } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ASSESSMENT_EXERCISES,
  AssessmentExercise,
  AssessmentSection,
  IntakeAnswers,
  SECTION_LABEL,
  visibleExercises,
} from "@/lib/assessment";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";
const MAX_SIZE_MB = 200;

type StoredVideo = {
  id: string;
  exercise_number: number;
  video_path: string;
  uploaded_at: string;
};

const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
};

const OnboardingAssessmentUpload = () => {
  const { user } = useAuth();
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const load = async () => {
    if (!user) return;
    try {
      const [i, v] = await Promise.all([
        sbGet<(IntakeAnswers & { locked_at: string | null })[]>(
          `client_intakes?client_id=eq.${user.id}&select=max_pull_ups,max_dips,max_push_ups,deep_squat,handstand,muscle_up,planche,front_lever,lsit_vsit,hspu,rope_climb,hamstrings,splits,shoulder_mobility,squat_flat_heels,backbend,locked_at&limit=1`
        ),
        sbGet<StoredVideo[]>(
          `assessment_videos?client_id=eq.${user.id}&select=id,exercise_number,video_path,uploaded_at&order=exercise_number.asc`
        ),
      ]);
      setIntake(i[0] ?? null);
      setLockedAt(i[0]?.locked_at ?? null);
      setVideos(v);
      // Sign every existing path so we can show previews
      const sigs: Record<number, string> = {};
      for (const row of v) {
        const url = await signUrl(row.video_path);
        if (url) sigs[row.exercise_number] = url;
      }
      setSignedUrls(sigs);
      setLoaded(true);
    } catch (e) {
      setError(String(e));
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signUrl = async (path: string): Promise<string | null> => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/assessment-videos/${path}`,
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

  const uploadFor = async (exercise: AssessmentExercise, file: File) => {
    if (!user) return;
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploading(exercise.n);
    setProgress(0);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${exercise.n}-${Date.now()}.${ext}`;
      const token = getToken();
      if (!token) throw new Error("Not signed in");

      // Remove the previous file for this slot (if any) so we don't leak storage
      const prev = videos.find((v) => v.exercise_number === exercise.n);
      if (prev) {
        await fetch(
          `${SUPABASE_URL}/storage/v1/object/assessment-videos/${prev.video_path}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      // Upload the new file
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${SUPABASE_URL}/storage/v1/object/assessment-videos/${path}`
        );
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

      // Upsert the DB row on (client_id, exercise_number)
      await fetch(
        `${SUPABASE_URL}/rest/v1/assessment_videos?on_conflict=client_id,exercise_number`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            client_id: user.id,
            exercise_number: exercise.n,
            exercise_name: exercise.name,
            video_path: path,
            uploaded_at: new Date().toISOString(),
          }),
        }
      );

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
      setProgress(0);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!intake) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <AlertCircle size={28} className="mx-auto text-accent" />
        <h1 className="font-heading text-2xl font-bold">
          Fill your intake first
        </h1>
        <p className="text-muted-foreground">
          Your assessment videos are tailored to your declared level — complete
          the intake form first so I only ask you to film what's relevant.
        </p>
        <Button asChild>
          <Link to="/app/onboarding/intake">Go to intake</Link>
        </Button>
      </div>
    );
  }

  if (lockedAt) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
          <Lock className="text-slate-700" size={30} />
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold">
          Assessment archived
        </h1>
        <p className="font-body text-muted-foreground leading-relaxed">
          Your videos were reviewed and archived by your coach on{" "}
          {new Date(lockedAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          . This is your starting point — videos are now locked to preserve the
          T0 snapshot.
        </p>
        <div className="pt-2 flex flex-wrap gap-2 justify-center">
          <Button asChild>
            <Link to="/app/archive">See my archive & coach review</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/home">Back to my space</Link>
          </Button>
        </div>
      </div>
    );
  }

  const shown = visibleExercises(intake);
  const uploadedNs = new Set(videos.map((v) => v.exercise_number));
  const uploadedCount = shown.filter((e) => uploadedNs.has(e.n)).length;

  const sections: AssessmentSection[] = ["required", "strength", "gymnastics", "mobility"];
  const bySection = Object.fromEntries(
    sections.map((s) => [s, shown.filter((e) => e.section === s)])
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">
          Onboarding · Step 2
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          Your assessment videos
        </h1>
        <p className="font-body text-muted-foreground mt-2 leading-relaxed">
          Film the exercises below. Take your time — these become the starting
          point your program is built on and stay saved in your space for
          reference.
        </p>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Progress
            </p>
            <p className="font-heading text-2xl font-bold">
              {uploadedCount} / {shown.length} videos sent
            </p>
          </div>
          {uploadedCount === shown.length && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm font-semibold">
              <CheckCircle2 size={16} />
              All sent
            </div>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(uploadedCount / Math.max(shown.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {sections.map((s) => {
        const list = bySection[s];
        if (!list.length) return null;
        return (
          <section key={s} className="space-y-3">
            <h2 className="font-heading text-lg uppercase tracking-widest text-muted-foreground">
              {SECTION_LABEL[s]}
            </h2>
            <div className="space-y-3">
              {list.map((e) => (
                <ExerciseSlot
                  key={e.n}
                  exercise={e}
                  existing={videos.find((v) => v.exercise_number === e.n) ?? null}
                  signedUrl={signedUrls[e.n] ?? null}
                  uploading={uploading === e.n}
                  progress={uploading === e.n ? progress : 0}
                  onFile={(file) => uploadFor(e, file)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="pt-4 text-center">
        <Button variant="outline" asChild>
          <Link to="/app/home">Back to my space</Link>
        </Button>
      </div>
    </div>
  );
};

const ExerciseSlot = ({
  exercise,
  existing,
  signedUrl,
  uploading,
  progress,
  onFile,
}: {
  exercise: AssessmentExercise;
  existing: StoredVideo | null;
  signedUrl: string | null;
  uploading: boolean;
  progress: number;
  onFile: (file: File) => void;
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  return (
    <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex gap-3">
        <span className="shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent font-heading font-bold flex items-center justify-center text-sm">
          {exercise.n}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading font-bold uppercase tracking-wide text-sm">
              {exercise.name}
            </p>
            {existing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                <CheckCircle2 size={10} /> Sent
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            {exercise.desc}
          </p>
        </div>
      </div>

      {existing && signedUrl && (
        <video
          src={signedUrl}
          controls
          className="w-full rounded-lg bg-black max-h-[320px]"
        />
      )}

      {uploading ? (
        <div className="border border-border rounded-lg p-3 text-xs">
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
        <div className="flex flex-wrap gap-2">
          <input
            ref={camInput}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={handle}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => camInput.current?.click()}
            className="gap-1.5"
          >
            <Camera size={14} /> {existing ? "Re-record" : "Record"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handle}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            className="gap-1.5"
          >
            {existing ? <RefreshCw size={14} /> : <Upload size={14} />}
            {existing ? "Replace file" : "Upload file"}
          </Button>
          {existing && signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 rounded-md border border-border h-9 hover:bg-muted"
            >
              <Play size={12} className="fill-current" /> Open full screen
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// Re-export to silence unused-import warnings if tree-shaking trips up
export { ASSESSMENT_EXERCISES };
export default OnboardingAssessmentUpload;
