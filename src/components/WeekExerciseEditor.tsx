import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Save, Video, ChevronDown, ChevronUp } from "lucide-react";
import { sbGet, sbPost, sbPatch, sbDelete } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  id: string;
  week_id: string;
  order_index: number;
  exercise_id: string | null;
  custom_name: string | null;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  video_url: string | null;
  group_name: string | null;
};

const WeekExerciseEditor = ({ weekId }: { weekId: string }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    if (items.length > 0) return;
    sbGet<Item[]>(
      `program_items?select=*&week_id=eq.${weekId}&order=order_index.asc`
    )
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [expanded, weekId]);

  const addItem = async () => {
    const next = items.length === 0 ? 0 : Math.max(...items.map((i) => i.order_index)) + 1;
    try {
      const created = await sbPost<Item[]>("program_items", {
        week_id: weekId,
        order_index: next,
        custom_name: "",
        sets: 3,
        reps: "10",
        rest_seconds: 60,
      });
      setItems([...items, ...created]);
    } catch (e) {
      setError(String(e));
    }
  };

  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems((its) => its.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const saveItem = async (item: Item) => {
    try {
      await sbPatch(`program_items?id=eq.${item.id}`, {
        custom_name: item.custom_name,
        sets: item.sets,
        reps: item.reps,
        rest_seconds: item.rest_seconds,
        notes: item.notes,
        video_url: item.video_url,
        order_index: item.order_index,
        group_name: item.group_name,
      });
    } catch (e) {
      setError(String(e));
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this exercise?")) return;
    try {
      await sbDelete(`program_items?id=eq.${id}`);
      setItems((its) => its.filter((i) => i.id !== id));
    } catch (e) {
      setError(String(e));
    }
  };

  const moveItem = async (id: string, direction: "up" | "down") => {
    const idx = items.findIndex((i) => i.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx];
    const b = items[swapIdx];
    const newItems = [...items];
    newItems[idx] = { ...b, order_index: a.order_index };
    newItems[swapIdx] = { ...a, order_index: b.order_index };
    setItems(newItems);
    try {
      await Promise.all([
        sbPatch(`program_items?id=eq.${a.id}`, { order_index: b.order_index }),
        sbPatch(`program_items?id=eq.${b.id}`, { order_index: a.order_index }),
      ]);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="border-t border-border pt-3 mt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-semibold hover:text-accent"
      >
        <span>
          Exercises {items.length > 0 && `(${items.length})`}
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {items.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">
              No exercises for this day yet.
            </p>
          )}

          {items.map((item, idx) => (
            <div
              key={item.id}
              className="bg-muted/30 rounded-lg p-3 border border-border space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, "up")}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, "down")}
                    disabled={idx === items.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <Input
                  value={item.custom_name ?? ""}
                  onChange={(e) => updateItem(item.id, { custom_name: e.target.value })}
                  placeholder="Exercise name (e.g. Pancake)"
                  className="flex-1 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="text-red-600 hover:bg-red-50 p-1 rounded"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Sets
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={item.sets ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        sets: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Reps / Duration
                  </label>
                  <Input
                    value={item.reps ?? ""}
                    onChange={(e) => updateItem(item.id, { reps: e.target.value })}
                    placeholder="8-12 or 30s"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Rest (s)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={item.rest_seconds ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        rest_seconds: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Video size={10} /> Video link (YouTube, Vimeo…)
                </label>
                <Input
                  value={item.video_url ?? ""}
                  onChange={(e) => updateItem(item.id, { video_url: e.target.value })}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Group (optional, e.g. SUPERSET 1, DROP SET)
                </label>
                <Input
                  value={item.group_name ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, {
                      group_name: e.target.value.trim() || null,
                    })
                  }
                  placeholder="SUPERSET 1"
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Notes / tips
                </label>
                <Textarea
                  value={item.notes ?? ""}
                  onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                  placeholder="Technique cues, alternatives, progressions…"
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveItem(item)}
                  className="h-7 text-xs gap-1"
                >
                  <Save size={12} /> Save
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="gap-2 w-full"
          >
            <Plus size={14} /> Add an exercise
          </Button>
        </div>
      )}
    </div>
  );
};

export default WeekExerciseEditor;
