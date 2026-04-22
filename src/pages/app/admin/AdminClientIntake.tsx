import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Save,
  Loader2,
} from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  INTAKE_OPTIONS,
  VERIFIABLE_FIELDS,
  STATUS_LABELS,
  AssessmentStatus,
} from "@/lib/intakeOptions";

type Intake = {
  client_id: string;
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
  splits: string[] | null;
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
  updated_at: string;
};

type Client = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type AssessmentVideo = {
  id: string;
  exercise_number: number;
  video_path: string;
};

type LevelAssessment = {
  field_name: string;
  actual_value: string | null;
  status: AssessmentStatus | null;
  notes: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
};

const AdminClientIntake = () => {
  const { id } = useParams<{ id: string }>();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [videos, setVideos] = useState<AssessmentVideo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});
  const [assessments, setAssessments] = useState<Record<string, LevelAssessment>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [c, i, v, a] = await Promise.all([
          sbGet<Client[]>(
            `profiles?id=eq.${id}&select=id,email,first_name,last_name&limit=1`
          ),
          sbGet<Intake[]>(`client_intakes?client_id=eq.${id}&select=*&limit=1`),
          sbGet<AssessmentVideo[]>(
            `assessment_videos?client_id=eq.${id}&select=id,exercise_number,video_path`
          ),
          sbGet<LevelAssessment[]>(
            `client_level_assessments?client_id=eq.${id}&select=field_name,actual_value,status,notes`
          ),
        ]);
        setClient(c[0] ?? null);
        setIntake(i[0] ?? null);
        setVideos(v);
        setAssessments(
          Object.fromEntries(a.map((row) => [row.field_name, row]))
        );
        const sigs: Record<number, string> = {};
        for (const vid of v) {
          const url = await signUrl(vid.video_path);
          if (url) sigs[vid.exercise_number] = url;
        }
        setSignedUrls(sigs);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  const updateField = (
    fieldName: string,
    patch: Partial<LevelAssessment>
  ) => {
    setAssessments((prev) => {
      const current = prev[fieldName] ?? {
        field_name: fieldName,
        actual_value: null,
        status: null,
        notes: null,
      };
      return { ...prev, [fieldName]: { ...current, ...patch, field_name: fieldName } };
    });
    setDirty((prev) => new Set(prev).add(fieldName));
    setSaveMsg(null);
  };

  const saveAll = async () => {
    if (!client || dirty.size === 0) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const token = getToken();
      const rows = [...dirty].map((fn) => {
        const a = assessments[fn] ?? {
          field_name: fn,
          actual_value: null,
          status: null,
          notes: null,
        };
        return {
          client_id: client.id,
          field_name: fn,
          actual_value: a.actual_value,
          status: a.status,
          notes: a.notes,
        };
      });
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/client_level_assessments?on_conflict=client_id,field_name`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(rows),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setDirty(new Set());
      setSaveMsg(`Saved ${rows.length} update${rows.length > 1 ? "s" : ""}.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );

  if (!client) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/admin/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to clients
        </Link>
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground">Client not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/app/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">
          Intake form
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          {client.first_name} {client.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">{client.email}</p>
      </div>

      {!intake ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="text-muted-foreground" size={22} />
          </div>
          <p className="font-body text-muted-foreground">
            This client hasn't filled their intake form yet.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar size={12} />
            Submitted{" "}
            {new Date(intake.submitted_at).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {intake.updated_at !== intake.submitted_at && (
              <span>
                {" "}· updated{" "}
                {new Date(intake.updated_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>

          <Section title="Basic info">
            <Row label="Full name" value={`${intake.first_name ?? ""} ${intake.last_name ?? ""}`} />
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

          <Section title="Goals">
            <Row label="Main goal" value={intake.main_goal} />
            <Row label="Specific skills to learn" value={intake.specific_skills?.join(", ")} />
            <Row label="Timeframe for results" value={intake.timeframe} />
            <Row label="Additional information" value={intake.additional_info} />
          </Section>

          {/* Coach review: declared + video + coach validation for each verifiable field */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="font-heading text-2xl font-bold">Coach review</h2>
                <p className="text-sm text-muted-foreground">
                  Compare what the client declared with what the videos show. Fill
                  Actual / Status / Notes for each verifiable skill — these take
                  priority when building programs.
                </p>
              </div>
              <Button
                onClick={saveAll}
                disabled={saving || dirty.size === 0}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving
                  ? "Saving…"
                  : dirty.size > 0
                    ? `Save ${dirty.size} change${dirty.size > 1 ? "s" : ""}`
                    : "Saved"}
              </Button>
            </div>
            {saveMsg && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
                {saveMsg}
              </div>
            )}
          </div>

          {(["strength", "skills", "mobility"] as const).map((section) => {
            const fields = VERIFIABLE_FIELDS.filter((f) => f.section === section);
            return (
              <Section key={section} title={sectionTitle(section)}>
                <div className="divide-y divide-border -mt-1">
                  {fields.map((f) => (
                    <FieldReviewRow
                      key={f.field}
                      field={f.field}
                      label={f.label}
                      declared={intake[f.field] as string | null}
                      options={INTAKE_OPTIONS[f.field] as readonly string[]}
                      videoUrl={f.exerciseN ? signedUrls[f.exerciseN] : undefined}
                      assessment={assessments[f.field]}
                      onChange={(patch) => updateField(f.field, patch)}
                    />
                  ))}
                </div>
              </Section>
            );
          })}
        </>
      )}
    </div>
  );
};

const sectionTitle = (s: "strength" | "skills" | "mobility") =>
  s === "strength" ? "Base strength" : s === "skills" ? "Skills level" : "Mobility";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-border overflow-hidden">
    <h2 className="font-heading text-lg font-bold px-5 pt-4">{title}</h2>
    <div className="px-0 pb-0">{children}</div>
  </section>
);

const Row = ({ label, value }: { label: string; value: string | null | undefined }) => {
  const isEmpty = !value || value.trim() === "" || value.trim() === ",";
  return (
    <div className="grid sm:grid-cols-3 gap-2 px-5 py-3 border-t border-border first:border-t-0">
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

const FieldReviewRow = ({
  field,
  label,
  declared,
  options,
  videoUrl,
  assessment,
  onChange,
}: {
  field: string;
  label: string;
  declared: string | null;
  options: readonly string[];
  videoUrl?: string;
  assessment?: LevelAssessment;
  onChange: (patch: Partial<LevelAssessment>) => void;
}) => {
  const actual = assessment?.actual_value ?? "";
  const status = assessment?.status ?? "";
  const notes = assessment?.notes ?? "";

  return (
    <div className="px-5 py-4 border-t border-border first:border-t-0 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Declared:</span>{" "}
            <span className="font-semibold">{declared || "—"}</span>
          </p>
        </div>
        {!videoUrl && (
          <span className="text-[11px] text-muted-foreground italic">
            No video sent yet
          </span>
        )}
      </div>

      {videoUrl && (
        <video src={videoUrl} controls className="w-full rounded-lg bg-black max-h-[280px]" />
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Actual level
          </label>
          <select
            value={actual}
            onChange={(e) => onChange({ actual_value: e.target.value || null })}
            className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
          >
            <option value="">— same as declared —</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Status
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_LABELS) as AssessmentStatus[]).map((s) => {
              const active = status === s;
              const meta = STATUS_LABELS[s];
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => onChange({ status: active ? null : s })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-accent text-white border-accent"
                      : "bg-white border-border hover:border-accent/50"
                  }`}
                >
                  {meta.emoji} {meta.short}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Coach notes
        </label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          placeholder="What the video shows, what the client still needs to work on…"
        />
      </div>
    </div>
  );
};

export default AdminClientIntake;
