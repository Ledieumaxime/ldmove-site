// Editor for a single template (warm-up or workout). Same set / group
// logic as the program session editor but the exercises live in a
// jsonb column on `templates.exercises` instead of one row per
// exercise. We keep the JSON in local state and PATCH the row each
// time the array mutates.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { sbGet, sbPatch } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ExerciseSearchPopover, {
  ExerciseSearchSelection,
} from "@/components/ExerciseSearchPopover";
import { TemplateRow, TemplateType } from "./AdminTemplates";

export type TemplateExercise = {
  name: string;
  sets: number | null;
  reps: string | null;
  tempo: string | null;
  load: string | null;
  rest_seconds: number | null;
  group_name: string | null;
  /** When the exercise isn't in the canonical library, the coach can
   *  paste a YouTube / Vimeo / Drive link here so the program editor
   *  still has a video to attach when the template is applied. */
  video_url?: string | null;
};

type SetType = "Single" | "Superset" | "Drop set" | "Circuit";

type UISet = {
  key: string;
  type: SetType;
  label: string | null;
  group_name: string | null;
  /** Indices in the exercises array (used to mutate in place). */
  itemIdx: number[];
};

const buildSets = (exercises: TemplateExercise[]): UISet[] => {
  const sets: UISet[] = [];
  let currentGroupKey: string | null = null;
  let currentSet: UISet | null = null;
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const gn = ex.group_name?.trim() || null;
    if (gn) {
      if (gn !== currentGroupKey) {
        currentSet = {
          key: `${gn}-${i}`,
          type: /drop/i.test(gn)
            ? "Drop set"
            : /circuit/i.test(gn)
              ? "Circuit"
              : "Superset",
          label: gn,
          group_name: gn,
          itemIdx: [i],
        };
        sets.push(currentSet);
        currentGroupKey = gn;
      } else if (currentSet) {
        currentSet.itemIdx.push(i);
      }
    } else {
      sets.push({
        key: `single-${i}`,
        type: "Single",
        label: null,
        group_name: null,
        itemIdx: [i],
      });
      currentGroupKey = null;
      currentSet = null;
    }
  }
  return sets;
};

const nextGroupLabel = (type: SetType, sets: UISet[]): string | null => {
  if (type === "Single") return null;
  const stem =
    type === "Superset"
      ? "Superset"
      : type === "Circuit"
        ? "Circuit"
        : "Drop set";
  const taken = new Set(
    sets
      .filter(
        (s) => s.group_name && new RegExp(`^${stem}\\s+\\d+$`, "i").test(s.group_name)
      )
      .map((s) => parseInt(s.group_name!.replace(/[^\d]/g, ""), 10))
      .filter((n) => Number.isFinite(n))
  );
  let n = 1;
  while (taken.has(n)) n++;
  return `${stem} ${n}`;
};

const blankExercise = (group_name: string | null = null): TemplateExercise => ({
  name: "",
  sets: 3,
  reps: "10",
  tempo: null,
  load: null,
  rest_seconds: 60,
  group_name,
});

const TYPE_HEADER: Record<TemplateType, { label: string; tint: string }> = {
  warmup: { label: "Warm-up template", tint: "bg-amber-50/60" },
  workout: { label: "Workout template", tint: "bg-blue-50/60" },
};

const AdminTemplateEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    sbGet<TemplateRow[]>(`templates?id=eq.${id}&select=*&limit=1`)
      .then((rows) => {
        if (rows.length === 0) {
          setError("Template not found");
          return;
        }
        setTemplate(rows[0]);
        setExercises(
          Array.isArray(rows[0].exercises)
            ? (rows[0].exercises as TemplateExercise[])
            : []
        );
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const flagSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const saveExercises = async (next: TemplateExercise[]) => {
    if (!template) return;
    setExercises(next);
    setSaveState("saving");
    try {
      await sbPatch(`templates?id=eq.${template.id}`, { exercises: next });
      flagSaved();
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  const saveMeta = async (patch: Partial<TemplateRow>) => {
    if (!template) return;
    setTemplate({ ...template, ...patch });
    setSaveState("saving");
    try {
      await sbPatch(`templates?id=eq.${template.id}`, patch);
      flagSaved();
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  const sets = useMemo(() => buildSets(exercises), [exercises]);

  const addSet = (type: SetType) => {
    const label = nextGroupLabel(type, sets);
    saveExercises([...exercises, blankExercise(label)]);
  };

  const addRowToSet = (set: UISet) => {
    const insertAfter = Math.max(...set.itemIdx);
    const next = [...exercises];
    next.splice(insertAfter + 1, 0, blankExercise(set.group_name));
    saveExercises(next);
  };

  const updateExercise = (idx: number, patch: Partial<TemplateExercise>) => {
    const next = exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    saveExercises(next);
  };

  const deleteExercise = (idx: number) => {
    const next = exercises.filter((_, i) => i !== idx);
    saveExercises(next);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading template…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!template) return null;

  const headerCfg = TYPE_HEADER[template.type];

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-24">
      <Link
        to="/app/admin/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to templates
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {headerCfg.label}
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold mt-1">
            {template.name}
          </h1>
        </div>
        {saveState !== "idle" && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-1 ${
              saveState === "saving"
                ? "bg-muted text-muted-foreground"
                : "bg-green-50 text-green-700"
            }`}
          >
            {saveState === "saving" ? (
              <>
                <Loader2 size={10} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={10} /> Saved
              </>
            )}
          </span>
        )}
      </div>

      {/* --- Meta --- */}
      <section className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Name
          </label>
          <Input
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            onBlur={(e) => saveMeta({ name: e.target.value })}
            className="mt-1 font-semibold"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Description (optional)
          </label>
          <Textarea
            value={template.description ?? ""}
            onChange={(e) =>
              setTemplate({ ...template, description: e.target.value })
            }
            onBlur={(e) =>
              saveMeta({ description: e.target.value.trim() || null })
            }
            rows={2}
            placeholder="Short reminder of when to use this template."
          />
        </div>
      </section>

      {/* --- Exercises --- */}
      <section className="bg-white rounded-2xl border border-border">
        <header
          className={`px-4 py-2.5 border-b border-border flex items-center justify-between rounded-t-2xl ${headerCfg.tint}`}
        >
          <h2 className="font-heading font-bold text-sm uppercase tracking-wide">
            Exercises
          </h2>
          <span className="text-[10px] font-semibold text-muted-foreground bg-white border border-border rounded-full px-2 py-0.5">
            {sets.length} set{sets.length === 1 ? "" : "s"}
          </span>
        </header>

        <div className="p-4 space-y-3">
          {sets.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No exercise yet. Use one of the buttons below to add the first
              set.
            </p>
          )}

          {sets.map((set) => (
            <TemplateSetCard
              key={set.key}
              set={set}
              exercises={exercises}
              onAddRow={() => addRowToSet(set)}
              onUpdate={updateExercise}
              onDelete={deleteExercise}
            />
          ))}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSet("Single")}
              className="gap-2 justify-start"
            >
              <Plus size={14} /> Single
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSet("Superset")}
              className="gap-2 justify-start"
            >
              <Plus size={14} /> Superset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSet("Drop set")}
              className="gap-2 justify-start"
            >
              <Plus size={14} /> Drop set
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSet("Circuit")}
              className="gap-2 justify-start"
            >
              <Plus size={14} /> Circuit
            </Button>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/app/admin/templates")}
        >
          Done
        </Button>
      </div>
    </div>
  );
};

// ----- nested components -----------------------------------------------

const TemplateSetCard = ({
  set,
  exercises,
  onAddRow,
  onUpdate,
  onDelete,
}: {
  set: UISet;
  exercises: TemplateExercise[];
  onAddRow: () => void;
  onUpdate: (idx: number, patch: Partial<TemplateExercise>) => void;
  onDelete: (idx: number) => void;
}) => {
  const isGroup = set.type !== "Single";
  const groupSetsSource = isGroup
    ? set.itemIdx.find((i) => exercises[i]?.sets != null)
    : undefined;
  const groupSets =
    groupSetsSource !== undefined ? exercises[groupSetsSource].sets : null;
  const [groupSetsDraft, setGroupSetsDraft] = useState<string>(
    groupSets == null ? "" : String(groupSets)
  );
  useEffect(() => {
    setGroupSetsDraft(groupSets == null ? "" : String(groupSets));
  }, [groupSets]);

  const groupRestSource = isGroup
    ? set.itemIdx.find((i) => exercises[i]?.rest_seconds != null)
    : undefined;
  const groupRest =
    groupRestSource !== undefined
      ? exercises[groupRestSource].rest_seconds
      : null;
  const [groupRestDraft, setGroupRestDraft] = useState<string>(
    groupRest == null ? "" : String(groupRest)
  );
  useEffect(() => {
    setGroupRestDraft(groupRest == null ? "" : String(groupRest));
  }, [groupRest]);

  const commitGroupSets = () => {
    const next = groupSetsDraft === "" ? null : Number(groupSetsDraft);
    if (next === groupSets) return;
    for (const i of set.itemIdx) {
      if (exercises[i]?.sets !== next) onUpdate(i, { sets: next });
    }
  };

  const commitGroupRest = () => {
    const next = groupRestDraft === "" ? null : Number(groupRestDraft);
    if (next === groupRest) return;
    for (const i of set.itemIdx) {
      if (exercises[i]?.rest_seconds !== next)
        onUpdate(i, { rest_seconds: next });
    }
  };

  return (
    <div
      className={`rounded-lg border ${
        isGroup ? "bg-muted/20 border-accent/30" : "bg-muted/10 border-border"
      } p-3 space-y-2`}
    >
      {isGroup && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-wide">
              {set.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({set.itemIdx.length} exercise
              {set.itemIdx.length === 1 ? "" : "s"})
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                {set.type === "Circuit" ? "Rounds" : "Sets"}
              </label>
              <Input
                type="number"
                min={0}
                value={groupSetsDraft}
                onChange={(e) => setGroupSetsDraft(e.target.value)}
                onBlur={commitGroupSets}
                className="h-7 w-16 text-sm"
                placeholder="3"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                Rest (s)
              </label>
              <Input
                type="number"
                min={0}
                value={groupRestDraft}
                onChange={(e) => setGroupRestDraft(e.target.value)}
                onBlur={commitGroupRest}
                className="h-7 w-16 text-sm"
                placeholder="90"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {set.itemIdx.map((i) => (
          <TemplateExerciseRow
            key={i}
            idx={i}
            exercise={exercises[i]}
            hideSetsField={isGroup}
            hideRestField={isGroup}
            onPatch={(patch) => onUpdate(i, patch)}
            onDelete={() => onDelete(i)}
          />
        ))}
      </div>

      {isGroup && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddRow}
          className="gap-2 w-full text-xs"
        >
          <Plus size={12} /> Add exercise to {set.label}
        </Button>
      )}
    </div>
  );
};

const TemplateExerciseRow = ({
  exercise,
  hideSetsField = false,
  hideRestField = false,
  onPatch,
  onDelete,
}: {
  idx: number;
  exercise: TemplateExercise;
  /** When true, omit the per-row Sets input — used inside Superset /
   *  Drop set groups whose rounds count lives at the group level. */
  hideSetsField?: boolean;
  /** When true, omit the per-row Rest input — used inside Superset /
   *  Drop set groups whose inter-round rest lives at the group level. */
  hideRestField?: boolean;
  onPatch: (patch: Partial<TemplateExercise>) => void;
  onDelete: () => void;
}) => {
  const [draftTempo, setDraftTempo] = useState(exercise.tempo ?? "");
  const [draftLoad, setDraftLoad] = useState(exercise.load ?? "");
  const [draftReps, setDraftReps] = useState(exercise.reps ?? "");
  const [draftSets, setDraftSets] = useState(
    exercise.sets == null ? "" : String(exercise.sets)
  );
  const [draftRest, setDraftRest] = useState(
    exercise.rest_seconds == null ? "" : String(exercise.rest_seconds)
  );

  // Custom exercise mode: lets the coach attach an exercise that
  // doesn't live in the canonical library, with a free name + a
  // user-pasted video link.
  const initialIsCustom = Boolean(exercise.video_url) && Boolean(exercise.name);
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [customName, setCustomName] = useState(exercise.name ?? "");
  const [customVideo, setCustomVideo] = useState(exercise.video_url ?? "");

  useEffect(() => setDraftTempo(exercise.tempo ?? ""), [exercise.tempo]);
  useEffect(() => setDraftLoad(exercise.load ?? ""), [exercise.load]);
  useEffect(() => setDraftReps(exercise.reps ?? ""), [exercise.reps]);
  useEffect(
    () => setDraftSets(exercise.sets == null ? "" : String(exercise.sets)),
    [exercise.sets]
  );
  useEffect(
    () =>
      setDraftRest(
        exercise.rest_seconds == null ? "" : String(exercise.rest_seconds)
      ),
    [exercise.rest_seconds]
  );
  useEffect(() => {
    setCustomName(exercise.name ?? "");
    setCustomVideo(exercise.video_url ?? "");
    setIsCustom(Boolean(exercise.video_url) && Boolean(exercise.name));
  }, [exercise.name, exercise.video_url]);

  const pick = (e: ExerciseSearchSelection) => {
    // Picking from the library wipes any previous custom video so the
    // program editor can rely on its lookup-by-name path.
    onPatch({ name: e.name, video_url: null });
  };

  const clear = () => onPatch({ name: "", video_url: null });

  const enterCustomMode = () => {
    setIsCustom(true);
  };

  const leaveCustomMode = () => {
    setIsCustom(false);
    setCustomName("");
    setCustomVideo("");
    onPatch({ name: "", video_url: null });
  };

  const commitCustomName = () => {
    if (customName !== exercise.name) onPatch({ name: customName });
  };

  const commitCustomVideo = () => {
    const next = customVideo.trim() || null;
    if (next !== (exercise.video_url ?? null)) onPatch({ video_url: next });
  };

  return (
    <div className="bg-white border border-border rounded-md p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          {isCustom ? (
            <>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onBlur={commitCustomName}
                placeholder="Exercise name (not in library)"
                className="h-8 text-sm font-semibold"
              />
              <Input
                value={customVideo}
                onChange={(e) => setCustomVideo(e.target.value)}
                onBlur={commitCustomVideo}
                placeholder="Video link (YouTube, Vimeo, …)"
                className="h-8 text-xs"
              />
            </>
          ) : (
            <ExerciseSearchPopover
              value={exercise.name || null}
              placeholder="Search exercise…"
              onSelect={pick}
              onClear={clear}
              size="sm"
            />
          )}
          <button
            type="button"
            onClick={isCustom ? leaveCustomMode : enterCustomMode}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {isCustom ? "← Use library exercise" : "Custom exercise (not in library)"}
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-red-600 hover:bg-red-50 p-1.5 rounded shrink-0"
          title="Remove exercise"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        className={`grid gap-2 ${
          hideSetsField && hideRestField
            ? "grid-cols-2 md:grid-cols-3"
            : hideSetsField || hideRestField
              ? "grid-cols-2 md:grid-cols-4"
              : "grid-cols-2 md:grid-cols-5"
        }`}
      >
        {!hideSetsField && (
          <NumField
            label="Sets"
            draft={draftSets}
            setDraft={setDraftSets}
            onCommit={() =>
              onPatch({
                sets: draftSets === "" ? null : Number(draftSets),
              })
            }
          />
        )}
        <TextField
          label="Reps"
          draft={draftReps}
          setDraft={setDraftReps}
          onCommit={() => onPatch({ reps: draftReps || null })}
          placeholder="8-12 or 30s"
        />
        <TextField
          label="Tempo"
          draft={draftTempo}
          setDraft={setDraftTempo}
          onCommit={() => onPatch({ tempo: draftTempo || null })}
          placeholder="0/3/0/1"
        />
        <TextField
          label="Load"
          draft={draftLoad}
          setDraft={setDraftLoad}
          onCommit={() => onPatch({ load: draftLoad || null })}
          placeholder="BW · 20kg · Band"
        />
        {!hideRestField && (
          <NumField
            label="Rest (s)"
            draft={draftRest}
            setDraft={setDraftRest}
            onCommit={() =>
              onPatch({
                rest_seconds: draftRest === "" ? null : Number(draftRest),
              })
            }
          />
        )}
      </div>
    </div>
  );
};

const NumField = ({
  label,
  draft,
  setDraft,
  onCommit,
}: {
  label: string;
  draft: string;
  setDraft: (v: string) => void;
  onCommit: () => void;
}) => (
  <div>
    <label className="text-[10px] font-semibold text-muted-foreground uppercase">
      {label}
    </label>
    <Input
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={onCommit}
      className="h-8 text-sm"
    />
  </div>
);

const TextField = ({
  label,
  draft,
  setDraft,
  onCommit,
  placeholder,
}: {
  label: string;
  draft: string;
  setDraft: (v: string) => void;
  onCommit: () => void;
  placeholder?: string;
}) => (
  <div>
    <label className="text-[10px] font-semibold text-muted-foreground uppercase">
      {label}
    </label>
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={onCommit}
      placeholder={placeholder}
      className="h-8 text-sm"
    />
  </div>
);

export default AdminTemplateEdit;
