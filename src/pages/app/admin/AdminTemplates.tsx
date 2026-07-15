// Admin index of warm-up + workout templates. Coach can browse, open
// the editor on a template, create a fresh one, or delete an obsolete
// one. The 'Use template' picker inside the program editor pulls from
// the same Supabase rows so anything the coach does here lands
// straight in the next bloc he builds.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Search,
  Trash2,
  Dumbbell,
  Flame,
} from "lucide-react";
import { sbDelete, sbGet, sbPost } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TemplateType = "warmup" | "workout";

export type TemplateRow = {
  id: string;
  type: TemplateType;
  name: string;
  description: string | null;
  exercises: unknown;
  created_at: string;
  updated_at: string;
};

const TYPE_LABEL: Record<TemplateType, string> = {
  warmup: "Warm-up",
  workout: "Workout",
};

const TYPE_ICON: Record<TemplateType, JSX.Element> = {
  warmup: <Flame size={14} className="text-amber-600" />,
  workout: <Dumbbell size={14} className="text-blue-600" />,
};

const AdminTemplates = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TemplateType | "all">("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await sbGet<TemplateRow[]>(
        "templates?select=*&order=type.asc,name.asc"
      );
      setRows(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filterType, search]);

  const exerciseCount = (r: TemplateRow): number =>
    Array.isArray(r.exercises) ? r.exercises.length : 0;

  const createTemplate = async (type: TemplateType) => {
    setCreating(true);
    try {
      const [created] = await sbPost<TemplateRow[]>("templates", {
        type,
        name: type === "warmup" ? "New warm-up" : "New workout",
        description: null,
        exercises: [],
      });
      navigate(`/app/admin/templates/${created.id}/edit`);
    } catch (e) {
      setError(String(e));
      setCreating(false);
    }
  };

  const removeTemplate = async (r: TemplateRow) => {
    if (
      !confirm(
        `Delete template "${r.name}"? This cannot be undone.\n\n(The blocs that already used it stay untouched.)`
      )
    )
      return;
    try {
      await sbDelete(`templates?id=eq.${r.id}`);
      setRows((prev) => prev.filter((p) => p.id !== r.id));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Library
          </p>
          <h1 className="font-heading text-3xl md:text-4xl font-bold mt-1">
            Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable warm-up and workout blocks. The 'Use template' button
            inside the program editor reads from this list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => createTemplate("warmup")}
            disabled={creating}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            New warm-up
          </Button>
          <Button
            type="button"
            onClick={() => createTemplate("workout")}
            disabled={creating}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            New workout
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1 border border-border">
          {(["all", "warmup", "workout"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`text-xs font-semibold rounded-full px-3 py-1 transition-colors ${
                filterType === t
                  ? "bg-white border border-border shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All" : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No templates yet. Click 'New warm-up' or 'New workout' to create your first one."
              : "No template matches your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow"
            >
              <Link
                to={`/app/admin/templates/${r.id}/edit`}
                className="flex-1 min-w-0"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {TYPE_ICON[r.type]}
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {TYPE_LABEL[r.type]}
                  </span>
                </div>
                <p className="font-heading font-bold text-base truncate">
                  {r.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {exerciseCount(r)} exercise{exerciseCount(r) === 1 ? "" : "s"}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => removeTemplate(r)}
                className="text-muted-foreground hover:text-red-600 hover:bg-red-50 p-2 rounded-lg shrink-0"
                title="Delete template"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTemplates;
