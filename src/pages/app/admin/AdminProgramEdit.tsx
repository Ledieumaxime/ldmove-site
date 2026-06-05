// Page 2 of the new program creation flow — the session editor.
//
// Layout:
//   - Header: program name + status pills (assigned client, draft/published)
//   - Session tabs (one per program_weeks row): switch between sessions
//   - Active session pane:
//       - Title (editable)
//       - "Warmup" sub-section with sets + exercises
//       - "Workout" sub-section with sets + exercises
//   - Sticky footer: Prev / Next session (or "Publish" on the last one)
//
// A *set* groups one or more exercise rows sharing the same group_name.
// Three types are supported:
//   - Single        → group_name = null (each item is its own row)
//   - Superset      → group_name = "Superset N"
//   - Drop set      → group_name = "Drop set N"
// Numbering is derived from the position of the set inside the section.
//
// Items keep the legacy `[WARMUP]` / `[WORKOUT]` prefix in custom_name
// so consumers like ProgramItemCard / parseNotes keep working without a
// db migration.
//
// Notes column packs Tempo / Load / Coach comment as "Tempo: X | Load:
// Y | comment". The UI splits them back into three separate fields and
// re-serialises on save.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  sbDelete,
  sbGet,
  sbGetAll,
  sbPatch,
  sbPost,
} from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ExerciseSearchPopover, {
  ExerciseSearchSelection,
} from "@/components/ExerciseSearchPopover";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "catalogue" | "custom";
  duration_weeks: number | null;
  assigned_client_id: string | null;
  is_published: boolean;
  is_archived: boolean;
};

type Week = {
  id: string;
  program_id: string;
  week_number: number;
  title: string;
  notes: string | null;
};

type Item = {
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
  exercise_id: string | null;
};

type Section = "WARMUP" | "WORKOUT";
type SetType = "Single" | "Superset" | "Drop set";

const SECTION_LABEL: Record<Section, string> = {
  WARMUP: "Warm up",
  WORKOUT: "Workout",
};

// ----- prefix / notes helpers -------------------------------------------

const stripPrefix = (s: string | null) =>
  s ? s.replace(/^\[[^\]]+\]\s*/, "") : "";

const sectionOf = (custom_name: string | null): Section => {
  if (!custom_name) return "WORKOUT";
  const m = custom_name.match(/^\[([^\]]+)\]/);
  if (m && /WARM/i.test(m[1])) return "WARMUP";
  return "WORKOUT";
};

const withSectionPrefix = (section: Section, name: string) =>
  `[${section}] ${name}`;

type ParsedNotes = {
  tempo: string;
  load: string;
  comment: string;
};

const parseNotesFields = (notes: string | null): ParsedNotes => {
  if (!notes) return { tempo: "", load: "", comment: "" };
  const parts = notes.split("|").map((p) => p.trim());
  let tempo = "";
  let load = "";
  const others: string[] = [];
  for (const p of parts) {
    const t = p.match(/^Tempo:\s*(.+)$/i);
    const l = p.match(/^Load:\s*(.+)$/i);
    if (t) tempo = t[1];
    else if (l) load = l[1];
    else if (p) others.push(p);
  }
  return { tempo, load, comment: others.join(" · ") };
};

const serializeNotes = ({ tempo, load, comment }: ParsedNotes): string | null => {
  const parts: string[] = [];
  if (tempo.trim()) parts.push(`Tempo: ${tempo.trim()}`);
  if (load.trim()) parts.push(`Load: ${load.trim()}`);
  if (comment.trim()) parts.push(comment.trim());
  return parts.length > 0 ? parts.join(" | ") : null;
};

// ----- set grouping ------------------------------------------------------

type UISet = {
  /** stable id used by React (composite of section + group_name + first item id) */
  key: string;
  type: SetType;
  /** displayed label (e.g. "Superset 1") — only for Superset / Drop set */
  label: string | null;
  group_name: string | null;
  items: Item[];
};

const buildSets = (items: Item[], section: Section): UISet[] => {
  const filtered = items
    .filter((it) => sectionOf(it.custom_name) === section)
    .sort((a, b) => a.order_index - b.order_index);

  const sets: UISet[] = [];
  let currentGroupKey: string | null = null;
  let currentSet: UISet | null = null;

  for (const it of filtered) {
    const gn = it.group_name?.trim() || null;
    if (gn) {
      if (gn !== currentGroupKey) {
        currentSet = {
          key: `${section}-${gn}-${it.id}`,
          type: /drop/i.test(gn) ? "Drop set" : "Superset",
          label: gn,
          group_name: gn,
          items: [],
        };
        sets.push(currentSet);
        currentGroupKey = gn;
      }
      currentSet!.items.push(it);
    } else {
      sets.push({
        key: `${section}-single-${it.id}`,
        type: "Single",
        label: null,
        group_name: null,
        items: [it],
      });
      currentGroupKey = null;
      currentSet = null;
    }
  }
  return sets;
};

// Used when creating a new Superset / Drop set to pick the next free
// numeric suffix in this section.
const nextGroupLabel = (
  type: SetType,
  existingSets: UISet[]
): string | null => {
  if (type === "Single") return null;
  const stem = type === "Superset" ? "Superset" : "Drop set";
  const taken = new Set(
    existingSets
      .filter((s) => s.group_name && new RegExp(`^${stem}\\s+\\d+$`, "i").test(s.group_name))
      .map((s) => parseInt(s.group_name!.replace(/[^\d]/g, ""), 10))
      .filter((n) => Number.isFinite(n))
  );
  let n = 1;
  while (taken.has(n)) n++;
  return `${stem} ${n}`;
};

// ============================================================ Page =====

const AdminProgramEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [program, setProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const savedTimer = useRef<number | null>(null);

  // session URL param is 1-indexed (?session=1)
  const sessionIdx = Math.max(
    0,
    parseInt(searchParams.get("session") ?? "1", 10) - 1
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [p, w] = await Promise.all([
          sbGet<Program[]>(`programs?id=eq.${id}&select=*&limit=1`),
          sbGet<Week[]>(
            `program_weeks?select=*&program_id=eq.${id}&order=week_number.asc`
          ),
        ]);
        if (cancelled) return;
        if (p.length === 0) {
          setError("Program not found");
          setLoading(false);
          return;
        }
        setProgram(p[0]);
        setWeeks(w);
        if (w.length > 0) {
          const its = await sbGetAll<Item>(
            `program_items?select=*&week_id=in.(${w
              .map((x) => x.id)
              .join(",")})&order=order_index.asc`
          );
          if (cancelled) return;
          setItems(its);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flagSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const safeSave = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      setSaveState("saving");
      try {
        const res = await fn();
        flagSaved();
        return res;
      } catch (e) {
        setSaveState("idle");
        setError(String(e));
        throw e;
      }
    },
    [flagSaved]
  );

  // ----- session navigation ----------------------------------------------

  const activeWeek = weeks[sessionIdx];
  const sessionItems = useMemo(
    () => (activeWeek ? items.filter((i) => i.week_id === activeWeek.id) : []),
    [items, activeWeek]
  );

  const updateSessionTitle = async (value: string) => {
    if (!activeWeek) return;
    setWeeks((ws) =>
      ws.map((w) => (w.id === activeWeek.id ? { ...w, title: value } : w))
    );
    await safeSave(() =>
      sbPatch(`program_weeks?id=eq.${activeWeek.id}`, { title: value })
    );
  };

  const goToSession = (idx: number) => {
    setSearchParams({ session: String(idx + 1) }, { replace: true });
  };

  // ----- items: add / patch / delete -------------------------------------

  const maxOrderIndex = useMemo(() => {
    return sessionItems.reduce(
      (max, it) => (it.order_index > max ? it.order_index : max),
      0
    );
  }, [sessionItems]);

  const addItem = async (
    section: Section,
    group_name: string | null,
    overrides: Partial<Item> = {}
  ) => {
    if (!activeWeek) return;
    const payload = {
      week_id: activeWeek.id,
      order_index: maxOrderIndex + 1,
      custom_name: withSectionPrefix(section, ""),
      sets: 3,
      reps: "10",
      rest_seconds: 60,
      notes: null,
      video_url: null,
      group_name,
      exercise_id: null,
      ...overrides,
    };
    const [created] = await safeSave(() =>
      sbPost<Item[]>("program_items", payload)
    );
    setItems((its) => [...its, created]);
  };

  const patchItem = async (id: string, patch: Partial<Item>) => {
    setItems((its) =>
      its.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
    await safeSave(() => sbPatch(`program_items?id=eq.${id}`, patch));
  };

  const deleteItem = async (id: string) => {
    await safeSave(() => sbDelete(`program_items?id=eq.${id}`));
    setItems((its) => its.filter((it) => it.id !== id));
  };

  // ----- "Add set" actions -----------------------------------------------

  const addSet = async (section: Section, type: SetType) => {
    const sets = buildSets(items, section);
    const label = nextGroupLabel(type, sets);
    if (type === "Single") {
      await addItem(section, null);
    } else {
      // Create one starter item — the coach can add more rows after.
      await addItem(section, label);
    }
  };

  const addRowToSet = async (section: Section, set: UISet) => {
    await addItem(section, set.group_name);
  };

  // ----- publish / unpublish --------------------------------------------

  const togglePublish = async () => {
    if (!program) return;
    const next = !program.is_published;
    setProgram({ ...program, is_published: next });
    await safeSave(() =>
      sbPatch(`programs?id=eq.${program.id}`, { is_published: next })
    );
  };

  // ----- render ----------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading program…
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
  if (!program) return null;

  const isLast = sessionIdx === weeks.length - 1;
  const isFirst = sessionIdx === 0;
  const backHref = program.assigned_client_id
    ? `/app/admin/clients/${program.assigned_client_id}`
    : "/app/admin/programs";

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-32">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back
      </Link>

      {/* ----- Header ----- */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Step 2 of 2 · Add exercises
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold mt-1">
            {program.title}
          </h1>
        </div>
        <SaveBadge state={saveState} />
      </div>

      {/* ----- Publish state banner ----- */}
      {program.is_published ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-green-800">
              ✓ Published — visible to the client
            </p>
            <p className="text-xs text-green-700/80">
              Switch back to draft if you need to keep editing without the
              client seeing changes.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={togglePublish}
            className="border-green-300 text-green-800 hover:bg-green-100"
          >
            Switch to draft
          </Button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-amber-900">
              Draft — hidden from the client
            </p>
            <p className="text-xs text-amber-800/80">
              The client doesn't see this program. Click "Publish" when you've
              finished filling all the sessions.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={togglePublish}
            className="gap-1.5 bg-amber-900 hover:bg-amber-950 text-white"
          >
            <Send size={14} /> Publish now
          </Button>
        </div>
      )}

      {/* ----- Session tabs ----- */}
      <div className="flex items-center gap-1 overflow-x-auto bg-muted/30 rounded-xl p-1 border border-border">
        {weeks.map((w, idx) => (
          <button
            key={w.id}
            type="button"
            onClick={() => goToSession(idx)}
            className={`shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ${
              idx === sessionIdx
                ? "bg-white border border-border shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {idx + 1}. {w.title || `Session ${idx + 1}`}
          </button>
        ))}
      </div>

      {/* ----- Active session ----- */}
      {activeWeek && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-border p-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Session name
            </label>
            <Input
              value={activeWeek.title ?? ""}
              onChange={(e) =>
                setWeeks((ws) =>
                  ws.map((w) =>
                    w.id === activeWeek.id ? { ...w, title: e.target.value } : w
                  )
                )
              }
              onBlur={(e) => updateSessionTitle(e.target.value)}
              className="mt-1 font-semibold"
              placeholder="e.g. Push"
            />
          </div>

          {(["WARMUP", "WORKOUT"] as Section[]).map((section) => (
            <SectionBlock
              key={section}
              section={section}
              items={sessionItems}
              onAddSet={(type) => addSet(section, type)}
              onAddRow={(set) => addRowToSet(section, set)}
              onPatch={patchItem}
              onDelete={deleteItem}
            />
          ))}
        </div>
      )}

      {/* ----- Footer ----- */}
      <div className="fixed bottom-4 left-4 right-4 z-30 max-w-5xl mx-auto bg-white border border-border rounded-2xl shadow-lg p-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => goToSession(sessionIdx - 1)}
          disabled={isFirst}
          className="gap-1"
        >
          <ChevronUp size={14} className="rotate-[-90deg]" /> Previous
        </Button>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Session {sessionIdx + 1} of {weeks.length}
        </p>
        {isLast ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate(backHref)}
            className="gap-1"
            title="Save and exit (the program stays in its current state — draft or published)"
          >
            Done
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => goToSession(sessionIdx + 1)}
            className="gap-1"
          >
            Next session <ChevronUp size={14} className="rotate-90" />
          </Button>
        )}
      </div>
    </div>
  );
};

// ============================================================ Section ==

const SectionBlock = ({
  section,
  items,
  onAddSet,
  onAddRow,
  onPatch,
  onDelete,
}: {
  section: Section;
  items: Item[];
  onAddSet: (type: SetType) => void;
  onAddRow: (set: UISet) => void;
  onPatch: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
}) => {
  const sets = useMemo(() => buildSets(items, section), [items, section]);

  return (
    <section className="bg-white rounded-2xl border border-border">
      <header
        className={`px-4 py-2.5 border-b border-border flex items-center justify-between rounded-t-2xl ${
          section === "WARMUP" ? "bg-amber-50/60" : "bg-blue-50/60"
        }`}
      >
        <h3 className="font-heading font-bold text-sm uppercase tracking-wide">
          {SECTION_LABEL[section]}
        </h3>
        <span className="text-[10px] font-semibold text-muted-foreground bg-white border border-border rounded-full px-2 py-0.5">
          {sets.length} set{sets.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="p-4 space-y-3">
        {sets.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No {SECTION_LABEL[section].toLowerCase()} yet.
          </p>
        )}

        {sets.map((set) => (
          <SetCard
            key={set.key}
            set={set}
            section={section}
            onAddRow={() => onAddRow(set)}
            onPatch={onPatch}
            onDelete={onDelete}
          />
        ))}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddSet("Single")}
            className="gap-2 justify-start"
            title="Add a single exercise (no group)"
          >
            <Plus size={14} /> Single
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddSet("Superset")}
            className="gap-2 justify-start"
            title="Add a superset (group of exercises with no rest between them)"
          >
            <Plus size={14} /> Superset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddSet("Drop set")}
            className="gap-2 justify-start"
            title="Add a drop set (group of exercises with decreasing load)"
          >
            <Plus size={14} /> Drop set
          </Button>
        </div>
      </div>
    </section>
  );
};

// =========================================================== SetCard ===

const SetCard = ({
  set,
  section,
  onAddRow,
  onPatch,
  onDelete,
}: {
  set: UISet;
  section: Section;
  onAddRow: () => void;
  onPatch: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
}) => {
  const isGroup = set.type !== "Single";

  return (
    <div
      className={`rounded-lg border ${
        isGroup ? "bg-muted/20 border-accent/30" : "bg-muted/10 border-border"
      } p-3 space-y-2`}
    >
      {isGroup && (
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-accent" />
          <span className="text-xs font-bold text-accent uppercase tracking-wide">
            {set.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({set.items.length} exercise{set.items.length === 1 ? "" : "s"})
          </span>
        </div>
      )}

      <div className="space-y-2">
        {set.items.map((it) => (
          <ExerciseRow
            key={it.id}
            item={it}
            section={section}
            onPatch={(patch) => onPatch(it.id, patch)}
            onDelete={() => onDelete(it.id)}
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

// ======================================================== ExerciseRow ==

const ExerciseRow = ({
  item,
  section,
  onPatch,
  onDelete,
}: {
  item: Item;
  section: Section;
  onPatch: (patch: Partial<Item>) => void;
  onDelete: () => void;
}) => {
  const parsed = useMemo(() => parseNotesFields(item.notes), [item.notes]);
  const [tempo, setTempo] = useState(parsed.tempo);
  const [load, setLoad] = useState(parsed.load);
  const [comment, setComment] = useState(parsed.comment);

  // Keep local state in sync when the item is replaced (e.g. another
  // session loaded).
  useEffect(() => {
    setTempo(parsed.tempo);
    setLoad(parsed.load);
    setComment(parsed.comment);
  }, [parsed.tempo, parsed.load, parsed.comment]);

  const onPickExercise = (e: ExerciseSearchSelection) => {
    onPatch({
      custom_name: withSectionPrefix(section, e.name),
      exercise_id: e.id,
      video_url: e.video_url,
    });
  };

  const onClearExercise = () => {
    onPatch({
      custom_name: withSectionPrefix(section, ""),
      exercise_id: null,
      video_url: null,
    });
  };

  const commitNotes = (next: ParsedNotes) => {
    const serialized = serializeNotes(next);
    if (serialized !== item.notes) {
      onPatch({ notes: serialized });
    }
  };

  const exerciseName = stripPrefix(item.custom_name) || null;

  return (
    <div className="bg-white border border-border rounded-md p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <ExerciseSearchPopover
            value={exerciseName}
            placeholder="Search exercise…"
            onSelect={onPickExercise}
            onClear={onClearExercise}
            size="sm"
          />
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <FieldNum
          label="Sets"
          value={item.sets}
          onCommit={(v) => onPatch({ sets: v })}
        />
        <FieldText
          label="Reps"
          value={item.reps ?? ""}
          placeholder="8-12 or 30s"
          onCommit={(v) => onPatch({ reps: v || null })}
        />
        <FieldText
          label="Tempo"
          value={tempo}
          placeholder="0/3/0/1"
          onChange={setTempo}
          onCommit={(v) => commitNotes({ tempo: v, load, comment })}
        />
        <FieldText
          label="Load"
          value={load}
          placeholder="BW · 20kg · Small band"
          onChange={setLoad}
          onCommit={(v) => commitNotes({ tempo, load: v, comment })}
        />
        <FieldNum
          label="Rest (s)"
          value={item.rest_seconds}
          onCommit={(v) => onPatch({ rest_seconds: v })}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase">
          Coach note <span className="opacity-50">(adds to the description)</span>
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => commitNotes({ tempo, load, comment })}
          placeholder="Cue this client specifically — leave empty if the description is enough."
          rows={2}
          className="text-sm"
        />
      </div>
    </div>
  );
};

// ============================================================ Fields ==

const FieldNum = ({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
}) => {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase">
        {label}
      </label>
      <Input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft === "" ? null : Number(draft);
          if (next !== value) onCommit(next);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
};

const FieldText = ({
  label,
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange?: (v: string) => void;
  onCommit: (v: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase">
        {label}
      </label>
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange?.(e.target.value);
        }}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
};

// ============================================================ Badge ==

const SaveBadge = ({ state }: { state: "idle" | "saving" | "saved" }) => {
  if (state === "idle") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-1 ${
        state === "saving"
          ? "bg-muted text-muted-foreground"
          : "bg-green-50 text-green-700"
      }`}
    >
      {state === "saving" ? (
        <>
          <Loader2 size={10} className="animate-spin" /> Saving…
        </>
      ) : (
        <>
          <Save size={10} /> Saved
        </>
      )}
    </span>
  );
};

export default AdminProgramEdit;
