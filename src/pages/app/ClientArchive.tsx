import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Loader2,
  Video as VideoIcon,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ASSESSMENT_EXERCISES,
  AssessmentExercise,
  AssessmentSection,
  SECTION_LABEL,
} from "@/lib/assessment";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

type AssessmentVideo = {
  id: string;
  exercise_number: number;
  exercise_name: string;
  video_path: string;
  uploaded_at: string;
};

type ProgressVideo = {
  id: string;
  video_url: string | null;
  archived_note: string | null;
  archived_at: string | null;
  created_at: string;
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

const signUrl = async (
  bucket: string,
  path: string
): Promise<string | null> => {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`,
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

const ClientArchive = () => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentVideo[]>([]);
  const [progress, setProgress] = useState<ProgressVideo[]>([]);
  const [assessmentUrls, setAssessmentUrls] = useState<Record<string, string>>({});
  const [progressUrls, setProgressUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [av, fc] = await Promise.all([
          sbGet<AssessmentVideo[]>(
            `assessment_videos?client_id=eq.${user.id}&select=id,exercise_number,exercise_name,video_path,uploaded_at&order=exercise_number.asc`
          ),
          sbGet<ProgressVideo[]>(
            `form_check_submissions?client_id=eq.${user.id}&archived_as_progress=eq.true&select=id,video_url,archived_note,archived_at,created_at&order=archived_at.desc`
          ),
        ]);
        setAssessments(av);
        setProgress(fc);

        const aSigs: Record<string, string> = {};
        for (const v of av) {
          const u = await signUrl("assessment-videos", v.video_path);
          if (u) aSigs[v.id] = u;
        }
        setAssessmentUrls(aSigs);

        const pSigs: Record<string, string> = {};
        for (const p of fc) {
          if (!p.video_url) continue;
          const u = await signUrl("form-checks", p.video_url);
          if (u) pSigs[p.id] = u;
        }
        setProgressUrls(pSigs);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  const hasAssessment = assessments.length > 0;
  const hasProgress = progress.length > 0;

  if (!hasAssessment && !hasProgress) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
          <VideoIcon className="text-muted-foreground" size={22} />
        </div>
        <h1 className="font-heading text-2xl font-bold">Your archive is empty</h1>
        <p className="text-sm text-muted-foreground">
          Your assessment videos will appear here once you send them. Later, every
          progress video your coach archives will land here too.
        </p>
        <Button asChild>
          <Link to="/app/onboarding/assessment">Go to assessment</Link>
        </Button>
      </div>
    );
  }

  // Group assessment videos by section for readability
  const byExercise = new Map<number, AssessmentVideo>(
    assessments.map((v) => [v.exercise_number, v])
  );
  const sections: AssessmentSection[] = ["required", "strength", "gymnastics", "mobility"];
  const assessmentBySection: Record<AssessmentSection, { exercise: AssessmentExercise; video: AssessmentVideo }[]> = {
    required: [], strength: [], gymnastics: [], mobility: [],
  };
  for (const ex of ASSESSMENT_EXERCISES) {
    const vid = byExercise.get(ex.n);
    if (vid) assessmentBySection[ex.section].push({ exercise: ex, video: vid });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">
          My archive
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          My progress videos
        </h1>
        <p className="font-body text-muted-foreground leading-relaxed mt-2">
          Every video you've shared with Maxime, in one place.
          <br />
          From your first assessment to your latest progress.
        </p>
      </div>

      {hasProgress && (
        <section className="bg-white border border-border rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setAchievementsOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <Trophy size={18} className="text-amber-700" />
            <span className="font-heading text-xl font-bold flex-1 text-left">
              Skill achievements
            </span>
            <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-semibold">
              {progress.length}
            </span>
            {achievementsOpen ? (
              <ChevronDown size={18} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={18} className="text-muted-foreground" />
            )}
          </button>
          {achievementsOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
              {progress.map((p) => (
                <div key={p.id} className="bg-muted/30 border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-heading font-bold text-sm">
                      {p.archived_note ?? "Skill achievement"}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(p.archived_at ?? p.created_at).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {progressUrls[p.id] ? (
                    <video
                      src={progressUrls[p.id]}
                      controls
                      className="w-full rounded-lg bg-black max-h-[360px]"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Video unavailable.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {hasAssessment && (
        <section className="bg-white border border-border rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setAssessmentOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <ClipboardList size={18} className="text-sky-700" />
            <span className="font-heading text-xl font-bold flex-1 text-left">
              Initial assessment
            </span>
            <span className="text-xs bg-sky-100 text-sky-800 rounded-full px-2 py-0.5 font-semibold">
              {assessments.length}
            </span>
            {assessmentOpen ? (
              <ChevronDown size={18} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={18} className="text-muted-foreground" />
            )}
          </button>
          {assessmentOpen && (
            <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
              {sections.map((s) => {
                const list = assessmentBySection[s];
                if (!list.length) return null;
                return (
                  <div key={s} className="space-y-3">
                    <h3 className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                      {SECTION_LABEL[s]}
                    </h3>
                    <div className="space-y-3">
                      {list.map(({ exercise, video }) => (
                        <div
                          key={video.id}
                          className="bg-muted/30 border border-border rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-heading font-bold uppercase tracking-wide text-sm">
                              <span className="text-accent mr-2">#{exercise.n}</span>
                              {exercise.name}
                            </p>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {new Date(video.uploaded_at).toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          {assessmentUrls[video.id] ? (
                            <video
                              src={assessmentUrls[video.id]}
                              controls
                              className="w-full rounded-lg bg-black max-h-[320px]"
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Video unavailable.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default ClientArchive;
