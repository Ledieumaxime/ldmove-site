import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Trophy, Loader2 } from "lucide-react";
import { sbGet, sbPost, sbDelete } from "@/integrations/supabase/api";

/**
 * Per-exercise workout logger. The client checks each set as they do it,
 * logs reps and (optional) weight. Sessions are grouped by date — opening
 * the page tomorrow shows a fresh tracker while still surfacing yesterday's
 * numbers as context.
 *
 * Coach view (readOnly) shows a compact summary: last session line + best PR.
 */

type Props = {
  itemId: string;
  prescribedSets: number;
  clientId: string;
  /** UUID of the current session run. Logs of the active tracker share
   *  this id; previous runs of the same exercise sit under different
   *  ids and feed the "Last" / "Best" lines. */
  sessionRunId: string;
  readOnly?: boolean;
  /** "reps" | "time" (in sec) | "attempts" — drives the unit label and
   *  whether we show the weight field. */
  unitLabel?: string;
  showWeight?: boolean;
};

type Log = {
  id: string;
  set_number: number;
  reps_done: number | null;
  weight_kg: number | null;
  session_run_id: string;
  session_date: string; // YYYY-MM-DD
  completed_at: string | null;
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

const WorkoutLogger = ({
  itemId,
  prescribedSets,
  clientId,
  sessionRunId,
  readOnly = false,
  unitLabel = "reps",
  showWeight = false,
}: Props) => {
  const today = useMemo(() => todayISO(), []);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSet, setSavingSet] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await sbGet<Log[]>(
          `workout_logs?client_id=eq.${clientId}&program_item_id=eq.${itemId}&select=id,set_number,reps_done,weight_kg,session_run_id,session_date,completed_at&order=session_date.desc,set_number.asc`
        );
        if (!cancelled) setLogs(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, clientId]);

  // Group logs by run
  const byRun = useMemo(() => {
    const map = new Map<string, Log[]>();
    for (const l of logs) {
      if (!map.has(l.session_run_id)) map.set(l.session_run_id, []);
      map.get(l.session_run_id)!.push(l);
    }
    return map;
  }, [logs]);

  // Logs of the run currently being executed by the client.
  const currentRunLogs = byRun.get(sessionRunId) ?? [];
  const todayBySet = new Map(currentRunLogs.map((l) => [l.set_number, l]));

  // Last finished run (any other run with completed_at set), most recent first.
  const completedRunIds = [...byRun.entries()]
    .filter(([id, ls]) => id !== sessionRunId && ls.some((l) => l.completed_at))
    .sort((a, b) => {
      const aDate = a[1][0]?.completed_at ?? "";
      const bDate = b[1][0]?.completed_at ?? "";
      return bDate.localeCompare(aDate);
    });
  const lastSessionLogs = completedRunIds[0]?.[1] ?? [];
  const lastSessionDate = lastSessionLogs[0]?.session_date ?? null;

  // Personal record (max reps_done, all sessions)
  const pr = useMemo(() => {
    let best: Log | null = null;
    for (const l of logs) {
      if (l.reps_done == null) continue;
      if (!best || (l.reps_done ?? 0) > (best.reps_done ?? 0)) best = l;
    }
    return best;
  }, [logs]);

  const upsertSet = async (
    setNumber: number,
    patch: { reps_done?: number | null; weight_kg?: number | null }
  ) => {
    setSavingSet(setNumber);
    try {
      const existing = todayBySet.get(setNumber);
      const body = {
        client_id: clientId,
        program_item_id: itemId,
        session_run_id: sessionRunId,
        session_date: today,
        set_number: setNumber,
        reps_done: existing?.reps_done ?? null,
        weight_kg: existing?.weight_kg ?? null,
        ...patch,
      };
      const url =
        "workout_logs?on_conflict=client_id,program_item_id,session_run_id,set_number";
      const rows = await sbPost<Log[]>(
        url + "&select=id,set_number,reps_done,weight_kg,session_run_id,session_date,completed_at",
        body,
        { merge: true }
      );
      const saved = rows[0];
      setLogs((prev) => {
        const filtered = prev.filter(
          (l) =>
            !(l.session_run_id === sessionRunId && l.set_number === setNumber)
        );
        return saved ? [...filtered, saved] : filtered;
      });
    } finally {
      setSavingSet(null);
    }
  };

  const clearSet = async (setNumber: number) => {
    const existing = todayBySet.get(setNumber);
    if (!existing) return;
    setSavingSet(setNumber);
    try {
      await sbDelete(`workout_logs?id=eq.${existing.id}`);
      setLogs((prev) => prev.filter((l) => l.id !== existing.id));
    } finally {
      setSavingSet(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 size={11} className="animate-spin" /> Loading…
      </div>
    );
  }

  // ---- Coach read-only view: compact summary, no inputs.
  if (readOnly) {
    if (logs.length === 0) {
      return (
        <p className="mt-2 text-[11px] text-muted-foreground italic">
          No sessions logged yet.
        </p>
      );
    }
    return (
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        {lastSessionLogs.length > 0 && (
          <p>
            <span className="font-semibold">Last:</span>{" "}
            {lastSessionLogs
              .sort((a, b) => a.set_number - b.set_number)
              .map((l) => l.reps_done ?? "—")
              .join(", ")}{" "}
            <span className="opacity-70">
              ({lastSessionDate ? formatDate(lastSessionDate) : "—"})
            </span>
          </p>
        )}
        {pr && pr.reps_done != null && (
          <p>
            <Trophy size={10} className="inline mr-1 text-amber-600" />
            <span className="font-semibold">Best:</span> {pr.reps_done} {unitLabel}{" "}
            <span className="opacity-70">({formatDate(pr.session_date)})</span>
          </p>
        )}
      </div>
    );
  }

  // ---- Client view: interactive tracker.
  if (!prescribedSets || prescribedSets <= 0) return null;

  const setsArray = Array.from({ length: prescribedSets }, (_, i) => i + 1);

  return (
    <div className="mt-3 space-y-2">
      {(lastSessionLogs.length > 0 || (pr && pr.reps_done != null)) && (
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {lastSessionLogs.length > 0 && (
            <p>
              <span className="font-semibold">Last:</span>{" "}
              {lastSessionLogs
                .sort((a, b) => a.set_number - b.set_number)
                .map((l) => l.reps_done ?? "—")
                .join(", ")}{" "}
              <span className="opacity-70">
                ({lastSessionDate ? formatDate(lastSessionDate) : "—"})
              </span>
            </p>
          )}
          {pr && pr.reps_done != null && (
            <p>
              <Trophy size={10} className="inline mr-1 text-amber-600" />
              <span className="font-semibold">Best:</span> {pr.reps_done}
              {pr.weight_kg ? ` · ${pr.weight_kg} kg` : ""}{" "}
              <span className="opacity-70">({formatDate(pr.session_date)})</span>
            </p>
          )}
        </div>
      )}

      <div className="bg-muted/40 border border-border rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Today
          </p>
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">
            {currentRunLogs.length}/{prescribedSets} done
          </p>
        </div>
        {setsArray.map((n) => {
          const log = todayBySet.get(n);
          const done = !!log;
          const saving = savingSet === n;
          return (
            <SetRow
              key={n}
              setNumber={n}
              done={done}
              reps={log?.reps_done ?? null}
              weight={log?.weight_kg ?? null}
              saving={saving}
              unitLabel={unitLabel}
              showWeight={showWeight}
              disabled={readOnly}
              onToggle={() => {
                if (readOnly) return;
                if (done) clearSet(n);
                else upsertSet(n, {});
              }}
              onChangeReps={(v) => upsertSet(n, { reps_done: v })}
              onChangeWeight={(v) => upsertSet(n, { weight_kg: v })}
            />
          );
        })}
      </div>
    </div>
  );
};

const SetRow = ({
  setNumber,
  done,
  reps,
  weight,
  saving,
  unitLabel,
  showWeight,
  disabled,
  onToggle,
  onChangeReps,
  onChangeWeight,
}: {
  setNumber: number;
  done: boolean;
  reps: number | null;
  weight: number | null;
  saving: boolean;
  unitLabel: string;
  showWeight: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChangeReps: (v: number | null) => void;
  onChangeWeight: (v: number | null) => void;
}) => {
  const [repsLocal, setRepsLocal] = useState(reps != null ? String(reps) : "");
  const [weightLocal, setWeightLocal] = useState(
    weight != null ? String(weight) : ""
  );

  // Sync from props (e.g. when log loads or after save)
  useEffect(() => {
    setRepsLocal(reps != null ? String(reps) : "");
  }, [reps]);
  useEffect(() => {
    setWeightLocal(weight != null ? String(weight) : "");
  }, [weight]);

  const commitReps = () => {
    const trimmed = repsLocal.trim();
    if (trimmed === "") {
      if (reps != null) onChangeReps(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (Number.isFinite(n) && n !== reps) onChangeReps(n);
  };

  const commitWeight = () => {
    const trimmed = weightLocal.trim().replace(",", ".");
    if (trimmed === "") {
      if (weight != null) onChangeWeight(null);
      return;
    }
    const n = parseFloat(trimmed);
    if (Number.isFinite(n) && n !== weight) onChangeWeight(n);
  };

  const inputsDisabled = disabled || saving;

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
        done ? "bg-green-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled || saving}
        aria-label={done ? `Mark set ${setNumber} undone` : `Mark set ${setNumber} done`}
        className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
          done
            ? "bg-green-500 border-green-500 text-white"
            : "bg-white border-border text-muted-foreground hover:border-green-400 active:scale-95"
        } ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : done ? (
          <CheckCircle2 size={16} />
        ) : (
          <span className="text-xs font-bold">{setNumber}</span>
        )}
      </button>

      <div
        className={`flex-1 grid gap-2 min-w-0 ${
          showWeight ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={repsLocal}
            disabled={inputsDisabled}
            onChange={(e) => setRepsLocal(e.target.value)}
            onBlur={commitReps}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label={`Set ${setNumber} ${unitLabel}`}
            className="w-full rounded-md border border-border bg-white pl-2 pr-12 py-1.5 text-sm focus:outline-none focus:border-accent disabled:bg-muted disabled:cursor-not-allowed"
            placeholder="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground uppercase pointer-events-none">
            {unitLabel}
          </span>
        </div>
        {showWeight && (
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={weightLocal}
              disabled={inputsDisabled}
              onChange={(e) => setWeightLocal(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              aria-label={`Set ${setNumber} weight in kilograms`}
              className="w-full rounded-md border border-border bg-white pl-2 pr-7 py-1.5 text-sm focus:outline-none focus:border-accent disabled:bg-muted disabled:cursor-not-allowed"
              placeholder="—"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground uppercase pointer-events-none">
              kg
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutLogger;
