import { Play } from "lucide-react";
import ExerciseComments from "@/components/ExerciseComments";
import FormCheckUpload from "@/components/FormCheckUpload";
import WorkoutLogger from "@/components/WorkoutLogger";

export type ProgramItem = {
  id: string;
  week_id: string;
  order_index: number;
  custom_name: string | null;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  video_url: string | null;
  group_name: string | null;
};

/** Notes are stored as "Tempo: 3s | Load: 20 kg | Keep back straight". */
export function parseNotes(notes: string | null) {
  if (!notes) return { tempo: null, load: null, comment: null };
  const parts = notes.split("|").map((p) => p.trim());
  let tempo: string | null = null;
  let load: string | null = null;
  const others: string[] = [];
  for (const p of parts) {
    const t = p.match(/^Tempo:\s*(.+)$/i);
    const l = p.match(/^Load:\s*(.+)$/i);
    if (t) tempo = t[1];
    else if (l) load = l[1];
    else if (p) others.push(p);
  }
  return { tempo, load, comment: others.join(" · ") || null };
}

/** Strip [SECTION] prefix from the exercise name. */
export function stripSection(name: string | null) {
  if (!name) return "Exercise";
  return name.replace(/^\[[^\]]+\]\s*/, "");
}

/** Read the [SECTION] prefix back as an uppercase tag. */
export function getSection(name: string | null): string {
  if (!name) return "EXERCISES";
  const match = name.match(/^\[([^\]]+)\]/);
  return match ? match[1].trim().toUpperCase() : "EXERCISES";
}

export function formatReps(reps: string | null) {
  if (!reps) return null;
  const trimmed = reps.trim();
  return trimmed || null;
}

/** Sections where we don't ask the client to log reps/weight: warmups,
 *  mobility flows and cooldowns are "info only". */
const NO_LOG_SECTIONS = new Set([
  "WARMUP",
  "WARM-UP",
  "WARM UP",
  "COOLDOWN",
  "COOL-DOWN",
  "COOL DOWN",
  "MOBILITY",
  "STRETCH",
  "STRETCHING",
]);

export type TrackingMode = "none" | "reps" | "time" | "attempts";

export type TrackingConfig = {
  mode: TrackingMode;
  unitLabel: string;
  showWeight: boolean;
};

/** Derive how the workout logger should render this item from its
 *  prescription. The logger always shows a single numeric input per
 *  set; the unit label adapts to what the coach prescribed.
 *  Weight is never tracked client-side: if the coach prescribes a
 *  load, the client just respects it (it's part of the prescription,
 *  not a metric to progress on).
 */
export function detectTracking(item: ProgramItem): TrackingConfig {
  const section = getSection(item.custom_name);
  if (NO_LOG_SECTIONS.has(section)) {
    return { mode: "none", unitLabel: "", showWeight: false };
  }

  const reps = (item.reps ?? "").toLowerCase().trim();

  // Max-effort holds: "max hold", "max sec", "max seconds".
  // Coach intent: log the duration the client managed.
  if (/^max\s*(hold|sec|second)/i.test(reps)) {
    return { mode: "time", unitLabel: "sec", showWeight: false };
  }

  // Free-form rep targets: "max reps", "max", "AMRAP".
  // Coach intent: do as many clean reps as possible, log the count.
  if (/^(amrap|max(\s*rep)?$|max\s*rep)/i.test(reps)) {
    return { mode: "reps", unitLabel: "reps", showWeight: false };
  }

  // Numeric time holds: "30s", "30 sec", "30 seconds", "1 min", "1m".
  if (
    /^\s*\d+(\.\d+)?\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i.test(
      reps
    )
  ) {
    return { mode: "time", unitLabel: "sec", showWeight: false };
  }

  // Handstand-style attempts: "5 attempts", "3 tries", "max attempts".
  if (/(attempt|tries|try)/i.test(reps)) {
    return { mode: "attempts", unitLabel: "tries", showWeight: false };
  }

  // Default: standard reps (covers "10", "8", "5 each leg", "8/leg", etc.).
  return { mode: "reps", unitLabel: "reps", showWeight: false };
}

type Props = {
  item: ProgramItem;
  compact?: boolean;
  /** Shows the comments thread (read + write). Default true.
   *  Disable on catalogue / generic views where there's no
   *  client-coach relationship to discuss. */
  canComment?: boolean;
  /** Renders the thread in archive mode: open by default, no compose
   *  form, no delete button, no toggle. Used on archived programs so
   *  the past stays consultable but immutable. */
  commentsReadOnly?: boolean;
  /** Shows the "send a form check video" UI. Default false — only
   *  the client doing their own session should see it (coaches don't
   *  upload form checks, and most overview pages aren't the right
   *  place to record one even for the client). */
  canUploadFormCheck?: boolean;
  accent?: string;
  inSuperset?: boolean;
  loggerClientId?: string | null;
  loggerReadOnly?: boolean;
  /** Inside a superset only the leading item carries `sets` (the group's
   *  round count); the followers have sets=null. Pass the group's sets
   *  here so the logger still renders one row per round on every item. */
  setsOverride?: number | null;
  /** UUID of the current session run. Required when the logger is
   *  interactive; ignored in read-only / coach views. */
  sessionRunId?: string;
};

const ProgramItemCard = ({
  item,
  compact = false,
  canComment = true,
  commentsReadOnly = false,
  canUploadFormCheck = false,
  accent = "",
  inSuperset = false,
  loggerClientId = null,
  loggerReadOnly = false,
  setsOverride = null,
  sessionRunId = "00000000-0000-0000-0000-000000000000",
}: Props) => {
  const { tempo, load, comment } = parseNotes(item.notes);
  const displayName = stripSection(item.custom_name);
  const hasLoad = !!load && load.trim() !== "" && load.trim() !== "-";
  const formattedReps = formatReps(item.reps);

  return (
    <div
      className={`bg-white border border-border rounded-lg ${
        compact ? "p-3" : "p-4"
      } hover:shadow-sm transition-shadow ${accent}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4
          className={`font-semibold ${
            compact ? "text-sm" : "text-base"
          } leading-snug`}
        >
          {displayName}
        </h4>
        {item.video_url && (
          <a
            href={item.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-accent text-white rounded-full px-2.5 py-1 hover:bg-accent/90"
          >
            <Play size={12} className="fill-current" /> Video
          </a>
        )}
      </div>

      {(() => {
        const rows: Array<[string, string]> = [];
        if (!inSuperset && item.sets != null) rows.push(["Set", String(item.sets)]);
        if (formattedReps) rows.push(["Rep", formattedReps]);
        if (hasLoad) rows.push(["Load", load!]);
        if (!inSuperset && item.rest_seconds != null)
          rows.push(["Rest", `${item.rest_seconds}s`]);
        if (tempo) rows.push(["Tempo", tempo]);
        if (rows.length === 0) return null;
        return (
          <div className="text-sm space-y-0.5 mt-1">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-2 items-baseline">
                <span className="font-semibold w-12 text-muted-foreground">{k}</span>
                <span className="text-accent">→</span>
                <span className="font-semibold text-foreground">{v}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {comment && (
        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
          {comment}
        </p>
      )}

      {(() => {
        const effectiveSets = setsOverride ?? item.sets;
        if (!loggerClientId || effectiveSets == null || effectiveSets <= 0)
          return null;
        const tracking = detectTracking(item);
        if (tracking.mode === "none") return null;
        return (
          <WorkoutLogger
            itemId={item.id}
            prescribedSets={effectiveSets}
            clientId={loggerClientId}
            sessionRunId={sessionRunId}
            readOnly={loggerReadOnly}
            unitLabel={tracking.unitLabel}
            showWeight={tracking.showWeight}
          />
        );
      })()}

      {canUploadFormCheck && <FormCheckUpload itemId={item.id} />}
      {canComment && (
        <ExerciseComments itemId={item.id} readOnly={commentsReadOnly} />
      )}
    </div>
  );
};

export default ProgramItemCard;
