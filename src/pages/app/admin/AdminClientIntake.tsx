import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
  Wrench,
  Lock,
} from "lucide-react";
import { sbGet, sbPatch, sbPost } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { INTAKE_OPTIONS, VERIFIABLE_FIELDS } from "@/lib/intakeOptions";
import IntakeSkillRow from "@/components/IntakeSkillRow";

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
  locked_at: string | null;
  locked_by: string | null;
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

type AssessmentStatus = "validated" | "needs_work";

type LevelAssessment = {
  field_name: string;
  status: AssessmentStatus | null;
  actual_value: string | null;
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
  const { profile } = useAuth();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [videos, setVideos] = useState<AssessmentVideo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});
  const [assessments, setAssessments] = useState<Record<string, LevelAssessment>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
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
            `client_level_assessments?client_id=eq.${id}&select=field_name,status,actual_value,notes`
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
        status: null,
        actual_value: null,
        notes: null,
      };
      return { ...prev, [fieldName]: { ...current, ...patch, field_name: fieldName } };
    });
    setDirty((prev) => new Set(prev).add(fieldName));
    setSaveMsg(null);
  };

  const lockOnboarding = async () => {
    if (!intake || !profile || intake.locked_at) return;
    const confirmed = window.confirm(
      "Archive & lock this onboarding?\n\nThe client will no longer be able to edit their intake answers or upload / replace assessment videos. Their level at T0 is frozen. This can only be reversed from Supabase."
    );
    if (!confirmed) return;
    setLocking(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const rows = await sbPatch<Intake[]>(
        `client_intakes?client_id=eq.${intake.client_id}`,
        { locked_at: now, locked_by: profile.id }
      );
      if (rows[0]) setIntake(rows[0]);
      // Notify the client that their intake has been validated.
      await sbPost("notifications", {
        user_id: intake.client_id,
        type: "intake_validated",
        title: "Your intake has been validated",
        body: "Maxime reviewed your intake and assessment videos. See his feedback in your profile.",
        link_url: "/app/intake",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLocking(false);
    }
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
          status: null,
          actual_value: null,
          notes: null,
        };
        // Normalise empties back to null so the client's read-only view
        // doesn't render stale boxes for whitespace-only overrides or notes.
        return {
          client_id: client.id,
          field_name: fn,
          status: a.status,
          actual_value: a.actual_value && a.actual_value.trim() ? a.actual_value : null,
          notes: a.notes && a.notes.trim() ? a.notes : null,
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
            {intake.updated_at !== intake.submitted_at && !intake.locked_at && (
              <span>
                {" "}· updated{" "}
                {new Date(intake.updated_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>

          {intake.locked_at && (
            <div className="bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 flex items-start gap-3">
              <Lock size={16} className="text-slate-700 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-800">
                <p className="font-semibold">Onboarding archived</p>
                <p className="text-slate-600">
                  Locked on{" "}
                  {new Date(intake.locked_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  . Intake answers and assessment videos are frozen. The client
                  can no longer edit them.
                </p>
              </div>
            </div>
          )}

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

          {(["strength", "skills", "mobility"] as const).map((section) => {
            const fields = VERIFIABLE_FIELDS.filter(
              (f) =>
                f.section === section &&
                f.exerciseN != null &&
                signedUrls[f.exerciseN]
            );
            if (!fields.length) return null;
            return (
              <Section key={section} title={sectionTitle(section)}>
                {fields.map((f) => (
                  <CoachSkillRow
                    key={f.field}
                    field={f.field}
                    label={f.label}
                    declared={intake[f.field] as string | null}
                    options={INTAKE_OPTIONS[f.field] as readonly string[]}
                    videoUrl={f.exerciseN ? signedUrls[f.exerciseN] : undefined}
                    assessment={assessments[f.field]}
                    onChange={(patch) => updateField(f.field, patch)}
                    locked={!!intake.locked_at}
                  />
                ))}
              </Section>
            );
          })}

          <Section title="Goals">
            <Row label="Main goal" value={intake.main_goal} />
            <Row label="Specific skills to learn" value={intake.specific_skills?.join(", ")} />
            <Row label="Timeframe for results" value={intake.timeframe} />
            <Row label="Additional information" value={intake.additional_info} />
          </Section>

          {saveMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              {saveMsg}
            </div>
          )}

          {!intake.locked_at && (
            <div className="sticky bottom-4 z-10 bg-white border border-border rounded-2xl shadow-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  {dirty.size > 0
                    ? `${dirty.size} unsaved change${dirty.size > 1 ? "s" : ""}`
                    : "All changes saved"}
                </p>
                <div className="flex flex-wrap gap-2">
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
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={lockOnboarding}
                    disabled={locking || dirty.size > 0}
                    className="gap-2"
                    title={
                      dirty.size > 0 ? "Save your review changes first" : undefined
                    }
                  >
                    {locking ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Lock size={16} />
                    )}
                    {locking ? "Archiving…" : "Archive & lock"}
                  </Button>
                </div>
              </div>
            </div>
          )}
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

/**
 * Coach-side row: renders the shared IntakeSkillRow (identical to the client's
 * view) and appends edit controls below when the intake isn't locked.
 */
const CoachSkillRow = ({
  label,
  declared,
  options,
  videoUrl,
  assessment,
  onChange,
  locked = false,
}: {
  field: string;
  label: string;
  declared: string | null;
  options: readonly string[];
  videoUrl?: string;
  assessment?: LevelAssessment;
  onChange: (patch: Partial<LevelAssessment>) => void;
  locked?: boolean;
}) => {
  const actual = assessment?.actual_value ?? "";
  const notes = assessment?.notes ?? "";
  const reviewed = assessment?.status ?? null;
  const [videoOpen, setVideoOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <IntakeSkillRow
      label={label}
      declared={declared}
      review={{
        status: reviewed,
        actual_value: actual.trim() ? actual : null,
        notes: notes.trim() ? notes : null,
      }}
      videoUrl={videoUrl}
      videoOpen={videoOpen}
      onToggleVideo={() => setVideoOpen((v) => !v)}
    >
      {!locked && (
        <div className="space-y-3">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-accent/60 hover:text-foreground transition-colors"
            >
              {reviewed ? "Edit review" : "Review this skill"}
            </button>
          ) : (
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ status: "validated" })}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                    reviewed === "validated"
                      ? "bg-green-50 border-green-400 text-green-800 font-semibold"
                      : "bg-white border-border text-muted-foreground hover:border-green-500"
                  }`}
                >
                  <CheckCircle2 size={12} /> Validated
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ status: "needs_work" })}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                    reviewed === "needs_work"
                      ? "bg-amber-50 border-amber-400 text-amber-800 font-semibold"
                      : "bg-white border-border text-muted-foreground hover:border-amber-500"
                  }`}
                >
                  <Wrench size={12} /> To work on
                </button>
              </div>

              {reviewed === "needs_work" && (
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Actual level (if different from declared)
                  </label>
                  <select
                    value={actual}
                    onChange={(e) => onChange({ actual_value: e.target.value || null })}
                    className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Same as declared</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reviewed && (
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Coach note
                  </label>
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => onChange({ notes: e.target.value })}
                    placeholder={
                      reviewed === "needs_work"
                        ? "What the video shows, what the client still needs to work on…"
                        : "Optional. Encouragement, cue to keep in mind, next step…"
                    }
                    className="bg-white"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </IntakeSkillRow>
  );
};

export default AdminClientIntake;
