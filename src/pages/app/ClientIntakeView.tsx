import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Loader2,
  CheckCircle2,
  Wrench,
  Play,
  ChevronDown,
} from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { VERIFIABLE_FIELDS } from "@/lib/intakeOptions";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

type Intake = {
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  injuries: string | null;
  days_per_week: string | null;
  session_length: string | null;
  sport_background: string | null;
  consistency: string | null;
  current_training: string[] | null;
  sessions_per_week: string | null;
  max_pull_ups: string | null;
  max_dips: string | null;
  max_push_ups: string | null;
  deep_squat: string | null;
  handstand: string | null;
  muscle_up: string | null;
  planche: string | null;
  front_lever: string | null;
  lsit_vsit: string | null;
  hspu: string | null;
  rope_climb: string | null;
  hamstrings: string | null;
  front_split_left: string | null;
  front_split_right: string | null;
  middle_split: string | null;
  shoulder_mobility: string | null;
  squat_flat_heels: string | null;
  backbend: string | null;
  main_goal: string | null;
  specific_skills: string[] | null;
  timeframe: string | null;
  additional_info: string | null;
  submitted_at: string;
  locked_at: string | null;
};

type AssessmentVideo = {
  exercise_number: number;
  video_path: string;
};

type LevelAssessment = {
  field_name: string;
  actual_value: string | null;
  notes: string | null;
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

const ClientIntakeView = () => {
  const { user } = useAuth();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [videoByExN, setVideoByExN] = useState<Record<number, string>>({});
  const [reviewByField, setReviewByField] = useState<Record<string, LevelAssessment>>({});
  const [loading, setLoading] = useState(true);
  const [openVideos, setOpenVideos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [i, v, r] = await Promise.all([
          sbGet<Intake[]>(`client_intakes?client_id=eq.${user.id}&select=*&limit=1`),
          sbGet<AssessmentVideo[]>(
            `assessment_videos?client_id=eq.${user.id}&select=exercise_number,video_path`
          ),
          sbGet<LevelAssessment[]>(
            `client_level_assessments?client_id=eq.${user.id}&select=field_name,actual_value,notes`
          ),
        ]);
        setIntake(i[0] ?? null);
        const sigs: Record<number, string> = {};
        for (const vid of v) {
          const url = await signUrl(vid.video_path);
          if (url) sigs[vid.exercise_number] = url;
        }
        setVideoByExN(sigs);
        setReviewByField(Object.fromEntries(r.map((row) => [row.field_name, row])));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleVideo = (field: string) => {
    setOpenVideos((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!intake) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
          <ClipboardList className="text-muted-foreground" size={22} />
        </div>
        <h1 className="font-heading text-2xl font-bold">No intake yet</h1>
        <p className="text-sm text-muted-foreground">
          You haven't filled your intake form yet.
        </p>
        <Button asChild>
          <Link to="/app/onboarding/intake">Go to intake</Link>
        </Button>
      </div>
    );
  }

  const verifiableBySection = {
    strength: VERIFIABLE_FIELDS.filter((f) => f.section === "strength"),
    skills: VERIFIABLE_FIELDS.filter((f) => f.section === "skills"),
    mobility: VERIFIABLE_FIELDS.filter((f) => f.section === "mobility"),
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/app/profile"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to profile
      </Link>

      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">
          My intake
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          {intake.first_name} {intake.last_name}
        </h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <Calendar size={12} />
          Submitted{" "}
          {new Date(intake.submitted_at).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      </div>

      <Section title="Basic info">
        <Row label="Gender" value={intake.gender} />
        <Row label="Age" value={intake.age != null ? `${intake.age} yrs` : null} />
        <Row label="Weight" value={intake.weight_kg != null ? `${intake.weight_kg} kg` : null} />
        <Row label="Height" value={intake.height_cm != null ? `${intake.height_cm} cm` : null} />
        <Row label="Injuries" value={intake.injuries} />
        <Row label="Days per week available" value={intake.days_per_week} />
        <Row label="Session length" value={intake.session_length} />
        <Row label="Sport background" value={intake.sport_background} />
      </Section>

      <Section title="Training history">
        <Row label="Consistency" value={intake.consistency} />
        <Row label="Current training" value={intake.current_training?.join(", ")} />
        <Row label="Sessions per week now" value={intake.sessions_per_week} />
      </Section>

      {(["strength", "skills", "mobility"] as const).map((section) => (
        <Section
          key={section}
          title={
            section === "strength"
              ? "Base strength"
              : section === "skills"
                ? "Skills level"
                : "Mobility"
          }
        >
          {verifiableBySection[section].map((f) => (
            <SkillRow
              key={f.field}
              label={f.label}
              declared={(intake as unknown as Record<string, string | null>)[f.field] ?? null}
              review={reviewByField[f.field]}
              videoUrl={f.exerciseN ? videoByExN[f.exerciseN] : undefined}
              isOpen={openVideos.has(f.field)}
              onToggleVideo={() => toggleVideo(f.field)}
            />
          ))}
        </Section>
      ))}

      <Section title="Goals">
        <Row label="Main goal" value={intake.main_goal} />
        <Row label="Specific skills to learn" value={intake.specific_skills?.join(", ")} />
        <Row label="Timeframe for results" value={intake.timeframe} />
        <Row label="Additional information" value={intake.additional_info} />
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-border overflow-hidden">
    <h2 className="font-heading text-lg font-bold px-5 pt-4">{title}</h2>
    <div>{children}</div>
  </section>
);

const Row = ({ label, value }: { label: string; value: string | null | undefined }) => {
  const isEmpty = !value || value.trim() === "" || value.trim() === ",";
  return (
    <div className="grid sm:grid-cols-3 gap-2 px-5 py-3 border-t border-border first:border-t-0 first:mt-3">
      <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide sm:col-span-1">
        {label}
      </dt>
      <dd
        className={`sm:col-span-2 text-sm ${
          isEmpty ? "text-muted-foreground italic" : "text-foreground"
        }`}
      >
        {isEmpty ? "—" : value}
      </dd>
    </div>
  );
};

const SkillRow = ({
  label,
  declared,
  review,
  videoUrl,
  isOpen,
  onToggleVideo,
}: {
  label: string;
  declared: string | null;
  review?: LevelAssessment;
  videoUrl?: string;
  isOpen: boolean;
  onToggleVideo: () => void;
}) => {
  const reviewState: "validated" | "needs_work" | null = review
    ? review.actual_value !== null || review.notes !== null
      ? "needs_work"
      : "validated"
    : null;
  const hasNote = !!(review?.notes && review.notes.trim() !== "");
  const actualDiffers = !!(
    review?.actual_value && review.actual_value !== declared
  );

  return (
    <div className="px-5 py-4 border-t border-border first:border-t-0 first:mt-3 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className="text-sm mt-0.5">
            <span className="font-semibold">{declared || "—"}</span>
          </p>
        </div>
        {reviewState === "validated" && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full px-2.5 py-1 shrink-0">
            <CheckCircle2 size={12} /> Validated
          </div>
        )}
        {reviewState === "needs_work" && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 shrink-0">
            <Wrench size={12} /> To work on
          </div>
        )}
      </div>

      {actualDiffers && (
        <p className="text-xs">
          <span className="text-muted-foreground font-semibold">Actual level:</span>{" "}
          <span className="font-semibold">{review?.actual_value}</span>
        </p>
      )}

      {hasNote && (
        <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 text-xs leading-relaxed">
          <p className="font-semibold text-amber-900 mb-0.5">Coach note</p>
          <p className="text-amber-900 whitespace-pre-wrap">{review?.notes}</p>
        </div>
      )}

      {videoUrl && (
        <div>
          <button
            type="button"
            onClick={onToggleVideo}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-accent/60 transition-colors"
          >
            {isOpen ? (
              <>
                <ChevronDown size={12} /> Hide video
              </>
            ) : (
              <>
                <Play size={12} className="fill-current" /> Show video
              </>
            )}
          </button>
          {isOpen && (
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg bg-black max-h-[320px] mt-3"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ClientIntakeView;
