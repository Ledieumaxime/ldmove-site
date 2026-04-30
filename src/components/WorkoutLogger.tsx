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
  readOnly?: boolean;
};

type Log = {
  id: string;
  set_number: number;
  reps_done: number | null;
  weight_kg: number | null;
  session_date: string; // YYYY-MM-DD
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
  readOnly = false,
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
          `workout_logs?client_id=eq.${clientId}&program_item_id=eq.${itemId}&select=id,set_number,reps_done,weight_kg,session_date&order=session_date.desc,set_number.asc`
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

  // Group logs by session date
  const bySession = useMemo(() => {
    const map = new Map<string, Log[]>();
    for (const l of logs) {
      if (!map.has(l.session_date)) map.set(l.session_date, []);
      map.get(l.session_date)!.push(l);
    }
    return map;
  }, [logs]);

  const todayLogs = bySession.get(today) ?? [];
  const todayBySet = new Map(todayLogs.map((l) => [l.set_number, l]));

  // Last session (excluding today)
  const lastSessionDate = [...bySession.keys()]
    .filter((d) => d !== today)
    .sort()
    .reverse()[0];
  const lastSessionLogs = lastSessionDate ? bySession.get(lastSessionDate)! : [];

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
        session_date: today,
        set_number: setNumber,
        reps_done: existing?.reps_done ?? null,
        weight_kg: existing?.weight_kg ?? null,
        ...patch,
      };
      const url =
        "workout_logs?on_conflict=client_id,program_item_id,session_date,set_number";
      const rows = await sbPost<Log[]>(
        url + "&select=id,set_number,reps_done,weight_kg,session_date",
        body,
        { merge: true }
      );
      const saved = rows[0];
      setLogs((prev) => {
        const filtered = prev.filter(
          (l) => !(l.session_date === today && l.set_number === setNumber)
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
            <span className="font-semibold">Best:</span> {pr.reps_done} reps
            {pr.weight_kg ? ` · ${pr.weight_kg} kg` : ""}{" "}
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Today
        </p>
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
              onToggle={() => {
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
  onToggle,
  onChangeReps,
  onChangeWeight,
}: {
  setNumber: number;
  done: boolean;
  reps: number | null;
  weight: number | null;
  saving: boolean;
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

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        aria-label={done ? `Mark set ${setNumber} undone` : `Mark set ${setNumber} done`}
        className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
          done
            ? "bg-green-500 border-green-500 text-white"
            : "bg-white border-border text-muted-foreground hover:border-green-400"
        }`}
      >
        {saving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : done ? (
          <CheckCircle2 size={14} />
        ) : (
          <span className="text-[11px] font-bold">{setNumber}</span>
        )}
      </button>
      <span className="text-xs text-muted-foreground w-8">Set {setNumber}</span>
      <label className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">reps</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={repsLocal}
          onChange={(e) => setRepsLocal(e.target.value)}
          onBlur={commitReps}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-14 rounded border border-border bg-white px-2 py-1 text-sm"
          placeholder="—"
        />
      </label>
      <label className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">kg</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          value={weightLocal}
          onChange={(e) => setWeightLocal(e.target.value)}
          onBlur={commitWeight}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-16 rounded border border-border bg-white px-2 py-1 text-sm"
          placeholder="—"
        />
      </label>
    </div>
  );
};

export default WorkoutLogger;
