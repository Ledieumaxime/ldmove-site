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
  Copy,
  Eye,
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

type TemplateExercise = {
  name: string;
  sets: number | null;
  reps: string | null;
  tempo: string | null;
  load: string | null;
  rest_seconds: number | null;
  group_name: string | null;
  /** Custom video link stored directly on the template when the
   *  exercise isn't in the canonical library. Falls back to the
   *  library lookup when absent. */
  video_url?: string | null;
};

type TemplateRow = {
  id: string;
  type: "warmup" | "workout";
  name: string;
  exercises: TemplateExercise[];
};

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
  // Resilient lookup so duplicate group labels — e.g. a Superset 1
  // fragmented across the section by an old insertion bug — collapse
  // back into a single rendered set. We still keep the in-DB order
  // (the items are sorted before this loop), we just stop creating a
  // brand-new UISet when one with the same group_name already exists.
  const setsByGroup = new Map<string, UISet>();

  for (const it of filtered) {
    const gn = it.group_name?.trim() || null;
    if (gn) {
      let existing = setsByGroup.get(gn);
      if (!existing) {
        existing = {
          key: `${section}-${gn}-${it.id}`,
          type: /drop/i.test(gn) ? "Drop set" : "Superset",
          label: gn,
          group_name: gn,
          items: [],
        };
        sets.push(existing);
        setsByGroup.set(gn, existing);
      }
      existing.items.push(it);
    } else {
      sets.push({
        key: `${section}-single-${it.id}`,
        type: "Single",
        label: null,
        group_name: null,
        items: [it],
      });
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

  // Delete the active session and every item inside it. The neighbour
  // weeks are renumbered so week_number stays a contiguous 1..N
  // sequence (avoids gaps that would make the tab labels confusing).
  // We then land the coach on the previous session if there's one, or
  // the first remaining session otherwise.
  const deleteCurrentSession = async () => {
    if (!activeWeek || !program) return;
    const sessionLabel =
      activeWeek.title || `Session ${activeWeek.week_number}`;
    const sessionItemsCount = items.filter(
      (i) => i.week_id === activeWeek.id
    ).length;
    if (
      !confirm(
        `Delete "${sessionLabel}"?\n\n${sessionItemsCount} exercise${
          sessionItemsCount === 1 ? "" : "s"
        } will be removed. This cannot be undone.`
      )
    )
      return;

    setSaveState("saving");
    try {
      // 1. wipe all program_items for this week
      await sbDelete(`program_items?week_id=eq.${activeWeek.id}`);
      // 2. drop the week itself
      await sbDelete(`program_weeks?id=eq.${activeWeek.id}`);
      // 3. pull every later week back by 1 so numbering stays
      // contiguous (1, 2, 3, …)
      const laterWeeks = weeks
        .filter((w) => w.week_number > activeWeek.week_number)
        .sort((a, b) => a.week_number - b.week_number);
      for (const w of laterWeeks) {
        await sbPatch(`program_weeks?id=eq.${w.id}`, {
          week_number: w.week_number - 1,
        });
      }
      // 4. update local state
      setItems((prev) => prev.filter((i) => i.week_id !== activeWeek.id));
      setWeeks((prev) =>
        prev
          .filter((w) => w.id !== activeWeek.id)
          .map((w) =>
            w.week_number > activeWeek.week_number
              ? { ...w, week_number: w.week_number - 1 }
              : w
          )
          .sort((a, b) => a.week_number - b.week_number)
      );
      flagSaved();
      // 5. navigate to the previous session if any, otherwise stay on
      // the first one (or the URL falls back to 1 even if no week
      // exists, which renders the empty-program shell — fine).
      const nextIdx = Math.max(0, sessionIdx - 1);
      setSearchParams(
        { session: String(nextIdx + 1) },
        { replace: true }
      );
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  // Swap the active session with its neighbour in the given direction.
  // We do it by swapping week_number values atomically: bump the
  // other side to a sentinel out-of-range value first so the unique
  // constraint on (program_id, week_number) is never temporarily
  // violated, then settle each row to its final position.
  const moveCurrentSession = async (direction: "up" | "down") => {
    if (!activeWeek) return;
    const otherIdx = direction === "up" ? sessionIdx - 1 : sessionIdx + 1;
    if (otherIdx < 0 || otherIdx >= weeks.length) return;
    const other = weeks[otherIdx];
    const a = activeWeek;
    const b = other;
    setSaveState("saving");
    try {
      // 1. park `a` at a unique sentinel so we can free its slot
      const sentinel = Math.max(...weeks.map((w) => w.week_number)) + 10;
      await sbPatch(`program_weeks?id=eq.${a.id}`, { week_number: sentinel });
      // 2. move `b` to `a`'s old position
      await sbPatch(`program_weeks?id=eq.${b.id}`, {
        week_number: a.week_number,
      });
      // 3. drop `a` into `b`'s old position
      await sbPatch(`program_weeks?id=eq.${a.id}`, {
        week_number: b.week_number,
      });
      setWeeks((prev) =>
        prev
          .map((w) => {
            if (w.id === a.id) return { ...w, week_number: b.week_number };
            if (w.id === b.id) return { ...w, week_number: a.week_number };
            return w;
          })
          .sort((x, y) => x.week_number - y.week_number)
      );
      flagSaved();
      // Follow the active session to its new position so the URL +
      // tabs stay in sync.
      setSearchParams(
        { session: String(b.week_number) },
        { replace: true }
      );
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  // Duplicate the current session: insert a new program_weeks row
  // right after it (week_number = current + 1, every later week
  // bumped by one) and clone every program_item with its full payload.
  const duplicateCurrentSession = async () => {
    if (!activeWeek || !program) return;
    // Shift later weeks down by 1 so we can insert the clone right after.
    const laterWeeks = weeks
      .filter((w) => w.week_number > activeWeek.week_number)
      .sort((a, b) => b.week_number - a.week_number); // descending so we don't trip the UNIQUE constraint
    setSaveState("saving");
    try {
      for (const w of laterWeeks) {
        await sbPatch(`program_weeks?id=eq.${w.id}`, {
          week_number: w.week_number + 1,
        });
      }
      const newWeekNumber = activeWeek.week_number + 1;
      const [created] = await sbPost<Week[]>("program_weeks", {
        program_id: program.id,
        week_number: newWeekNumber,
        title: `${activeWeek.title} (copy)`,
        notes: activeWeek.notes,
      });
      // Clone every item from the source week onto the new one.
      const sourceItems = items.filter((i) => i.week_id === activeWeek.id);
      let createdItems: Item[] = [];
      if (sourceItems.length > 0) {
        const payload = sourceItems
          .sort((a, b) => a.order_index - b.order_index)
          .map((it) => ({
            week_id: created.id,
            order_index: it.order_index,
            custom_name: it.custom_name,
            sets: it.sets,
            reps: it.reps,
            rest_seconds: it.rest_seconds,
            notes: it.notes,
            video_url: it.video_url,
            group_name: it.group_name,
            exercise_id: it.exercise_id,
          }));
        createdItems = await sbPost<Item[]>("program_items", payload);
      }
      // Refresh local state.
      setWeeks((prev) => {
        const bumped = prev.map((w) =>
          w.week_number > activeWeek.week_number
            ? { ...w, week_number: w.week_number + 1 }
            : w
        );
        return [...bumped, created].sort(
          (a, b) => a.week_number - b.week_number
        );
      });
      setItems((prev) => [...prev, ...createdItems]);
      flagSaved();
      // Land on the freshly created session.
      setSearchParams(
        { session: String(newWeekNumber) },
        { replace: true }
      );
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  // ----- items: add / patch / delete -------------------------------------

  const maxOrderIndex = useMemo(() => {
    return sessionItems.reduce(
      (max, it) => (it.order_index > max ? it.order_index : max),
      0
    );
  }, [sessionItems]);

  // Insert a new program_item.
  //
  // `insertAfterOrderIndex` controls where the item lands:
  //   - undefined  → appended at the end of the current session.
  //   - a number   → inserted immediately after that order_index.
  //                  Every later item in the session is bumped by 1
  //                  in the DB so the (week_id, order_index) ordering
  //                  stays a clean contiguous run.
  //
  // The bump-then-insert path is what lets "Add exercise to Superset 1"
  // keep the new row inside its group: without it, the new row would
  // pick up `max + 1` and end up after every other set, fragmenting
  // the superset into two visually distinct blocks that share a name.
  const addItem = async (
    section: Section,
    group_name: string | null,
    overrides: Partial<Item> = {},
    insertAfterOrderIndex?: number
  ) => {
    if (!activeWeek) return;
    let nextOrderIndex = maxOrderIndex + 1;
    let bumped: Item[] = [];
    if (insertAfterOrderIndex !== undefined) {
      const targetOrder = insertAfterOrderIndex + 1;
      bumped = sessionItems.filter((it) => it.order_index >= targetOrder);
      // Bump in descending order so the UNIQUE constraint on
      // (week_id, order_index) isn't briefly violated.
      const desc = [...bumped].sort((a, b) => b.order_index - a.order_index);
      for (const it of desc) {
        await sbPatch(`program_items?id=eq.${it.id}`, {
          order_index: it.order_index + 1,
        });
      }
      nextOrderIndex = targetOrder;
    }
    const payload = {
      week_id: activeWeek.id,
      order_index: nextOrderIndex,
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
    setItems((its) => {
      const bumpedIds = new Set(bumped.map((b) => b.id));
      const updated = its.map((it) =>
        bumpedIds.has(it.id)
          ? { ...it, order_index: it.order_index + 1 }
          : it
      );
      return [...updated, created];
    });
  };

  const patchItem = async (id: string, patch: Partial<Item>) => {
    setItems((its) =>
      its.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
    await safeSave(() => sbPatch(`program_items?id=eq.${id}`, patch));
  };

  const deleteItem = async (id: string) => {
    // Capture which section the row lived in so we can renumber it
    // after the delete (deleting the only row in a Superset removes
    // the group; later groups in the same section should slide down
    // a number).
    const target = items.find((it) => it.id === id);
    await safeSave(() => sbDelete(`program_items?id=eq.${id}`));
    setItems((its) => its.filter((it) => it.id !== id));
    if (target) {
      await renumberSection(sectionOf(target.custom_name));
    }
  };

  // Swap a set / superset / drop set with its neighbour in the given
  // section. The set being moved (A) and its partner (B) trade
  // order_index ranges so the rendered position changes accordingly.
  //
  // To stay safe under the (week_id, order_index) UNIQUE constraint
  // we first park every affected row at a sentinel order beyond the
  // session's current max, then settle each row at its final value.
  const moveSet = async (
    section: Section,
    setIdx: number,
    direction: "up" | "down"
  ) => {
    if (!activeWeek) return;
    // CRITICAL: build sets from the items of the ACTIVE session, not
    // the full items array. Otherwise indexes don't match what the
    // SectionBlock rendered (which also uses sessionItems), and the
    // function ends up swapping rows from another session.
    const sets = buildSets(sessionItems, section);
    const otherIdx = direction === "up" ? setIdx - 1 : setIdx + 1;
    if (setIdx < 0 || setIdx >= sets.length) return;
    if (otherIdx < 0 || otherIdx >= sets.length) return;
    const setA = sets[setIdx];
    const setB = sets[otherIdx];
    const aItems = [...setA.items].sort(
      (x, y) => x.order_index - y.order_index
    );
    const bItems = [...setB.items].sort(
      (x, y) => x.order_index - y.order_index
    );
    const aSize = aItems.length;
    const bSize = bItems.length;

    let aShift: number;
    let bShift: number;
    if (direction === "up") {
      // A currently sits after B → swap so A lands where B was.
      aShift = -bSize;
      bShift = aSize;
    } else {
      // A currently sits before B → swap so A lands where B was.
      aShift = bSize;
      bShift = -aSize;
    }

    const sessionMax = sessionItems.reduce(
      (m, i) => (i.order_index > m ? i.order_index : m),
      0
    );
    let sentinel = sessionMax + 100;

    setSaveState("saving");
    try {
      // Park every affected row at a guaranteed-free order_index.
      for (const it of [...aItems, ...bItems]) {
        await sbPatch(`program_items?id=eq.${it.id}`, {
          order_index: sentinel++,
        });
      }
      // Settle each row at its target.
      for (const it of aItems) {
        await sbPatch(`program_items?id=eq.${it.id}`, {
          order_index: it.order_index + aShift,
        });
      }
      for (const it of bItems) {
        await sbPatch(`program_items?id=eq.${it.id}`, {
          order_index: it.order_index + bShift,
        });
      }
      const aIds = new Set(aItems.map((x) => x.id));
      const bIds = new Set(bItems.map((x) => x.id));
      const nextItems = items.map((it) => {
        if (aIds.has(it.id))
          return { ...it, order_index: it.order_index + aShift };
        if (bIds.has(it.id))
          return { ...it, order_index: it.order_index + bShift };
        return it;
      });
      setItems(nextItems);
      flagSaved();
      // After the swap, the visible sequence has changed → make the
      // Superset / Drop set numbers follow the new order. Pass the
      // post-mutation array so we don't read the stale state closure.
      await renumberSection(section, nextItems);
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  // ----- "Add set" actions -----------------------------------------------

  // Pick where a freshly added item should land in `order_index` so it
  // shows up at the end of its own section, not at the end of the
  // whole session. Without this anchor, a new Warm-up Single would
  // get `max(session) + 1`, slip past every Workout item and break
  // section ordering as soon as we ever flatten the list.
  const lastOrderIndexInSection = (section: Section): number | undefined => {
    const inSection = sessionItems.filter(
      (it) => sectionOf(it.custom_name) === section
    );
    if (inSection.length === 0) return undefined;
    return inSection.reduce(
      (max, it) => (it.order_index > max ? it.order_index : max),
      -Infinity
    );
  };

  // Walk the section's sets in display order and patch group_name so
  // Superset / Drop set numbers reflect the actual visible sequence
  // (Superset 1, Superset 2, … per type, restart in each section).
  // Called after every operation that can move groups around so the
  // numbering never goes 'Superset 4 → Superset 10' just because the
  // counter was incremented and the lower numbers got reused.
  //
  // `itemsOverride` lets the caller hand in the post-mutation items
  // array. React batches state updates so the outer `items` closure
  // we'd otherwise read here can still be the pre-mutation snapshot.
  const renumberSection = async (
    section: Section,
    itemsOverride?: Item[]
  ) => {
    if (!activeWeek) return;
    const source = itemsOverride ?? items;
    const sectionItems = source.filter(
      (it) =>
        it.week_id === activeWeek.id &&
        sectionOf(it.custom_name) === section
    );
    const sets = buildSets(sectionItems, section);
    let supersetN = 0;
    let dropsetN = 0;
    const updates: Array<{ id: string; group_name: string }> = [];
    for (const set of sets) {
      if (set.type === "Single" || !set.group_name) continue;
      let target: string;
      if (set.type === "Superset") {
        supersetN += 1;
        target = `Superset ${supersetN}`;
      } else {
        dropsetN += 1;
        target = `Drop set ${dropsetN}`;
      }
      if (set.group_name === target) continue;
      for (const it of set.items) {
        updates.push({ id: it.id, group_name: target });
      }
    }
    if (updates.length === 0) return;
    setSaveState("saving");
    try {
      for (const u of updates) {
        await sbPatch(`program_items?id=eq.${u.id}`, {
          group_name: u.group_name,
        });
      }
      setItems((prev) => {
        const byId = new Map(updates.map((u) => [u.id, u.group_name]));
        return prev.map((it) =>
          byId.has(it.id) ? { ...it, group_name: byId.get(it.id)! } : it
        );
      });
      flagSaved();
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
    }
  };

  const addSet = async (section: Section, type: SetType) => {
    // Use sessionItems so the next Superset / Drop set number is
    // computed per-session, not across the whole program.
    const sets = buildSets(sessionItems, section);
    const label = nextGroupLabel(type, sets);
    const anchor = lastOrderIndexInSection(section);
    if (type === "Single") {
      await addItem(section, null, {}, anchor);
    } else {
      // Create one starter item — the coach can add more rows after.
      await addItem(section, label, {}, anchor);
    }
    // Even though nextGroupLabel picks the next free slot, the
    // *displayed* numbers can still drift on the existing data (we
    // inherited some "Superset 10" labels from the global-counter
    // bug). Run a renumber pass so the section's labels always read
    // 1, 2, 3, … in order.
    await renumberSection(section);
  };

  const addRowToSet = async (section: Section, set: UISet) => {
    // Insert right after the last existing item of this set so the
    // group stays contiguous and the buildSets parser keeps it as a
    // single Superset / Drop set instead of fragmenting it.
    const lastInSet = set.items.reduce(
      (max, it) => Math.max(max, it.order_index),
      -1
    );
    await addItem(section, set.group_name, {}, lastInSet);
  };

  // Bulk-insert all exercises of a template (warm-up or workout) into
  // the active session's matching section, appending after any
  // existing items. We hit the exercises table once with name=in.(...)
  // to grab ids / video_url for all needed names in a single
  // round-trip, then POST one batch of program_items.
  const applyTemplate = async (
    template: TemplateRow,
    section: Section
  ) => {
    if (!activeWeek) return;
    const names = [...new Set(template.exercises.map((e) => e.name))];
    const inList = names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",");
    const lib = await sbGet<
      { id: string; name: string; video_url: string | null }[]
    >(
      `exercises?select=id,name,video_url&name=in.(${encodeURIComponent(
        inList
      )})&limit=2000`
    );
    const libByName = new Map(
      lib.map((e) => [e.name.toLowerCase(), e])
    );
    // Anchor the bulk insert right after the last existing item *in
    // the same section* so a Warm-up template doesn't leapfrog the
    // workout in `order_index`. Items already placed further down
    // (e.g. workout items when applying a warmup template after some
    // workout already exists) get bumped by the size of the payload.
    const sectionLast = lastOrderIndexInSection(section);
    const baseIdx = sectionLast ?? 0;
    const shiftCount = template.exercises.length;
    const toBump = sessionItems
      .filter((it) => it.order_index > baseIdx)
      .sort((a, b) => b.order_index - a.order_index); // desc to avoid UNIQUE clash
    setSaveState("saving");
    for (const it of toBump) {
      await sbPatch(`program_items?id=eq.${it.id}`, {
        order_index: it.order_index + shiftCount,
      });
    }
    const payload = template.exercises.map((ex, i) => {
      const hit = libByName.get(ex.name.toLowerCase());
      const parts: string[] = [];
      if (ex.tempo && ex.tempo.trim()) parts.push(`Tempo: ${ex.tempo.trim()}`);
      if (ex.load && ex.load.trim()) parts.push(`Load: ${ex.load.trim()}`);
      const notes = parts.length > 0 ? parts.join(" | ") : null;
      const useCustomVideo = !!ex.video_url;
      return {
        week_id: activeWeek.id,
        order_index: baseIdx + i + 1,
        custom_name: withSectionPrefix(section, ex.name),
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        notes,
        video_url: useCustomVideo
          ? ex.video_url ?? null
          : hit?.video_url ?? null,
        group_name: ex.group_name,
        exercise_id: useCustomVideo ? null : hit?.id ?? null,
      };
    });
    const created = await safeSave(() =>
      sbPost<Item[]>("program_items", payload)
    );
    setItems((its) => {
      const bumpedIds = new Set(toBump.map((b) => b.id));
      const updated = its.map((it) =>
        bumpedIds.has(it.id)
          ? { ...it, order_index: it.order_index + shiftCount }
          : it
      );
      return [...updated, ...created];
    });
    // Templates carry their own Superset 1 / Drop set 1 etc. labels;
    // applying one into a section that already has groups can produce
    // duplicates or collisions. Renumber the section so the final
    // labels read 1, 2, 3, … in display order regardless of source.
    await renumberSection(section);
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
        <div className="flex items-center gap-2 flex-wrap">
          <SaveBadge state={saveState} />
          <a
            href={`/app/programs/${program.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border border-border bg-white hover:bg-muted/40"
            title="Open the client view in a new tab"
          >
            <Eye size={12} /> Preview
          </a>
        </div>
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
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Session name
                </label>
                <Input
                  value={activeWeek.title ?? ""}
                  onChange={(e) =>
                    setWeeks((ws) =>
                      ws.map((w) =>
                        w.id === activeWeek.id
                          ? { ...w, title: e.target.value }
                          : w
                      )
                    )
                  }
                  onBlur={(e) => updateSessionTitle(e.target.value)}
                  className="mt-1 font-semibold"
                  placeholder="e.g. Push"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveCurrentSession("up")}
                  disabled={sessionIdx === 0}
                  className="px-2"
                  title="Move session up"
                >
                  <ChevronUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveCurrentSession("down")}
                  disabled={sessionIdx === weeks.length - 1}
                  className="px-2"
                  title="Move session down"
                >
                  <ChevronDown size={14} />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={duplicateCurrentSession}
                className="gap-1.5 shrink-0"
                title="Create a copy of this session right after it"
              >
                <Copy size={14} /> Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deleteCurrentSession}
                className="gap-1.5 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                title="Delete this session and all its exercises"
              >
                <Trash2 size={14} /> Delete
              </Button>
            </div>
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
              onMoveSet={(setIdx, dir) => moveSet(section, setIdx, dir)}
              onUseTemplate={(t) => applyTemplate(t, section)}
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
  onMoveSet,
  onUseTemplate,
}: {
  section: Section;
  items: Item[];
  onAddSet: (type: SetType) => void;
  onAddRow: (set: UISet) => void;
  onPatch: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
  onMoveSet?: (setIdx: number, direction: "up" | "down") => Promise<void>;
  onUseTemplate?: (template: TemplateRow) => Promise<void>;
}) => {
  const sets = useMemo(() => buildSets(items, section), [items, section]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const wantedType: "warmup" | "workout" =
    section === "WARMUP" ? "warmup" : "workout";

  // Fetch the templates on first open of the picker so we don't pull
  // them on every editor mount.
  useEffect(() => {
    if (!templateOpen || templatesLoaded) return;
    sbGet<TemplateRow[]>(
      `templates?select=id,type,name,exercises&type=eq.${wantedType}&order=name.asc&limit=500`
    )
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoaded(true));
  }, [templateOpen, templatesLoaded, wantedType]);

  return (
    <section className="bg-white rounded-2xl border border-border">
      <header
        className={`px-4 py-2.5 border-b border-border flex items-center justify-between rounded-t-2xl ${
          section === "WARMUP" ? "bg-amber-50/60" : "bg-blue-50/60"
        }`}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-bold text-sm uppercase tracking-wide">
            {SECTION_LABEL[section]}
          </h3>
          <span className="text-[10px] font-semibold text-muted-foreground bg-white border border-border rounded-full px-2 py-0.5">
            {sets.length} set{sets.length === 1 ? "" : "s"}
          </span>
        </div>
        {onUseTemplate && (
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTemplateOpen((v) => !v)}
              disabled={applyingTemplate}
              className="gap-1.5 h-8 bg-white"
            >
              {applyingTemplate ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Applying…
                </>
              ) : (
                <>
                  <Layers size={12} /> Use template
                  <ChevronDown size={12} />
                </>
              )}
            </Button>
            {templateOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setTemplateOpen(false)}
                />
                <div className="absolute z-50 right-0 mt-1 w-72 max-h-80 overflow-y-auto bg-white border border-border rounded-xl shadow-lg">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-2.5 pb-1">
                    Pick a {wantedType === "warmup" ? "warm-up" : "workout"} template
                  </p>
                  {!templatesLoaded ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      Loading…
                    </p>
                  ) : templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      No template yet. Create one from{" "}
                      <a
                        href="/app/admin/templates"
                        className="text-accent underline"
                      >
                        Templates
                      </a>
                      .
                    </p>
                  ) : null}
                  <ul>
                    {templates.map((t) => (
                      <li
                        key={t.id}
                        className="border-t border-border first:border-t-0"
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            setTemplateOpen(false);
                            setApplyingTemplate(true);
                            try {
                              await onUseTemplate(t);
                            } finally {
                              setApplyingTemplate(false);
                            }
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted/40"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {t.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t.exercises.length} exercise
                            {t.exercises.length === 1 ? "" : "s"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <div className="p-4 space-y-3">
        {sets.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No {SECTION_LABEL[section].toLowerCase()} yet.
          </p>
        )}

        {sets.map((set, idx) => (
          <SetCard
            key={set.key}
            set={set}
            section={section}
            canMoveUp={!!onMoveSet && idx > 0}
            canMoveDown={!!onMoveSet && idx < sets.length - 1}
            onMoveUp={
              onMoveSet ? () => onMoveSet(idx, "up") : undefined
            }
            onMoveDown={
              onMoveSet ? () => onMoveSet(idx, "down") : undefined
            }
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
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onAddRow,
  onPatch,
  onDelete,
}: {
  set: UISet;
  section: Section;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddRow: () => void;
  onPatch: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
}) => {
  const isGroup = set.type !== "Single";
  // For supersets and drop sets, both the rounds count and the rest
  // between rounds belong to the whole group, not to each exercise.
  // We expose them at the SetCard header and mirror the value back
  // onto every item so the read-side (and any future export) sees a
  // consistent superset.
  const groupSetsSource = set.items.find((i) => i.sets != null);
  const groupSets = groupSetsSource?.sets ?? null;
  const [groupSetsDraft, setGroupSetsDraft] = useState<string>(
    groupSets == null ? "" : String(groupSets)
  );
  useEffect(() => {
    setGroupSetsDraft(groupSets == null ? "" : String(groupSets));
  }, [groupSets]);

  const groupRestSource = set.items.find((i) => i.rest_seconds != null);
  const groupRest = groupRestSource?.rest_seconds ?? null;
  const [groupRestDraft, setGroupRestDraft] = useState<string>(
    groupRest == null ? "" : String(groupRest)
  );
  useEffect(() => {
    setGroupRestDraft(groupRest == null ? "" : String(groupRest));
  }, [groupRest]);

  const commitGroupSets = () => {
    const next = groupSetsDraft === "" ? null : Number(groupSetsDraft);
    if (next === groupSets) return;
    for (const it of set.items) {
      if (it.sets !== next) onPatch(it.id, { sets: next });
    }
  };

  const commitGroupRest = () => {
    const next = groupRestDraft === "" ? null : Number(groupRestDraft);
    if (next === groupRest) return;
    for (const it of set.items) {
      if (it.rest_seconds !== next) onPatch(it.id, { rest_seconds: next });
    }
  };

  const moveButtons = (onMoveUp || onMoveDown) && (
    <div className="flex flex-col gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
        title="Move set up"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
        title="Move set down"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );

  return (
    <div
      className={`rounded-lg border ${
        isGroup ? "bg-muted/20 border-accent/30" : "bg-muted/10 border-border"
      } p-3 space-y-2`}
    >
      {isGroup ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {moveButtons}
            <Layers size={14} className="text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-wide">
              {set.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({set.items.length} exercise{set.items.length === 1 ? "" : "s"})
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                Rounds
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
      ) : moveButtons ? (
        // Single set: no native header — surface the move arrows as a
        // small chip in the top-right so the coach can still reorder.
        <div className="flex justify-end">{moveButtons}</div>
      ) : null}

      <div className="space-y-2">
        {set.items.map((it) => (
          <ExerciseRow
            key={it.id}
            item={it}
            section={section}
            hideSetsField={isGroup}
            hideRestField={isGroup}
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
  hideSetsField = false,
  hideRestField = false,
  onPatch,
  onDelete,
}: {
  item: Item;
  section: Section;
  /** Hide the per-row Sets field. Used inside Superset / Drop set
   *  groups where the rounds count is shared and shown at the group
   *  level instead. */
  hideSetsField?: boolean;
  /** Hide the per-row Rest field. Used inside Superset / Drop set
   *  groups where the inter-round rest is shared and shown at the
   *  group level instead. */
  hideRestField?: boolean;
  onPatch: (patch: Partial<Item>) => void;
  onDelete: () => void;
}) => {
  const parsed = useMemo(() => parseNotesFields(item.notes), [item.notes]);
  const [tempo, setTempo] = useState(parsed.tempo);
  const [load, setLoad] = useState(parsed.load);
  const [comment, setComment] = useState(parsed.comment);

  const exerciseName = stripPrefix(item.custom_name) || "";
  // A row is "custom" (not from the canonical library) when it has no
  // exercise_id link but the coach has written a name or a video URL.
  // Empty rows default to library mode so the picker is the first
  // thing the coach sees.
  const initialIsCustom =
    !item.exercise_id && (Boolean(exerciseName) || Boolean(item.video_url));
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [customName, setCustomName] = useState(exerciseName);
  const [customVideo, setCustomVideo] = useState(item.video_url ?? "");

  // Keep local state in sync when the item is replaced (e.g. another
  // session loaded).
  useEffect(() => {
    setTempo(parsed.tempo);
    setLoad(parsed.load);
    setComment(parsed.comment);
  }, [parsed.tempo, parsed.load, parsed.comment]);

  useEffect(() => {
    setCustomName(exerciseName);
    setCustomVideo(item.video_url ?? "");
    setIsCustom(
      !item.exercise_id && (Boolean(exerciseName) || Boolean(item.video_url))
    );
  }, [item.id, item.exercise_id, exerciseName, item.video_url]);

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

  const enterCustomMode = () => {
    setIsCustom(true);
    // Drop the library link so a name typed manually doesn't keep
    // pointing at a stale exercises row.
    if (item.exercise_id) {
      onPatch({ exercise_id: null });
    }
  };

  const leaveCustomMode = () => {
    setIsCustom(false);
    onPatch({
      custom_name: withSectionPrefix(section, ""),
      exercise_id: null,
      video_url: null,
    });
    setCustomName("");
    setCustomVideo("");
  };

  const commitCustomName = () => {
    const next = withSectionPrefix(section, customName.trim());
    if (next !== item.custom_name) onPatch({ custom_name: next });
  };

  const commitCustomVideo = () => {
    const next = customVideo.trim() || null;
    if (next !== item.video_url) onPatch({ video_url: next });
  };

  const commitNotes = (next: ParsedNotes) => {
    const serialized = serializeNotes(next);
    if (serialized !== item.notes) {
      onPatch({ notes: serialized });
    }
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
              value={exerciseName || null}
              placeholder="Search exercise…"
              onSelect={onPickExercise}
              onClear={onClearExercise}
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
        className={`grid gap-2 grid-cols-2 ${
          hideSetsField && hideRestField
            ? "md:grid-cols-3"
            : hideSetsField || hideRestField
              ? "md:grid-cols-4"
              : "md:grid-cols-5"
        }`}
      >
        {!hideSetsField && (
          <FieldNum
            label="Sets"
            value={item.sets}
            onCommit={(v) => onPatch({ sets: v })}
          />
        )}
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
        {!hideRestField && (
          <FieldNum
            label="Rest (s)"
            value={item.rest_seconds}
            onCommit={(v) => onPatch({ rest_seconds: v })}
          />
        )}
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
