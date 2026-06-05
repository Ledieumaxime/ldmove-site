// Autocomplete popover that lets the coach pick an exercise from the
// canonical library while building or editing a program. The user types
// a few letters, the matching exercises appear in a dropdown grouped
// by tag (FACE / category) and a click commits the selection.
//
// On select we return both the canonical name (for custom_name) and
// the row id + video_url so the parent can wire program_items.exercise_id
// and program_items.video_url without an extra round-trip.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";

type Exercise = {
  id: string;
  name: string;
  video_url: string | null;
  description: string | null;
  tags: string[] | null;
};

let libraryCache: Exercise[] | null = null;

const loadLibrary = async (): Promise<Exercise[]> => {
  if (libraryCache) return libraryCache;
  const rows = await sbGet<Exercise[]>(
    "exercises?select=id,name,video_url,description,tags&order=name.asc&limit=2000"
  );
  libraryCache = rows;
  return rows;
};

export type ExerciseSearchSelection = {
  id: string;
  name: string;
  video_url: string | null;
  description: string | null;
};

type Props = {
  /** Currently picked name, if any (display only). */
  value?: string | null;
  placeholder?: string;
  onSelect: (e: ExerciseSearchSelection) => void;
  /** Show a small "clear" cross next to the value when set. */
  onClear?: () => void;
  /** Visual size tweak. */
  size?: "sm" | "md";
};

const normalise = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const ExerciseSearchPopover = ({
  value,
  placeholder,
  onSelect,
  onClear,
  size = "md",
}: Props) => {
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const matches = useMemo(() => {
    const q = normalise(query.trim());
    if (!q) return library.slice(0, 30);
    return library
      .filter((e) => normalise(e.name).includes(q))
      .slice(0, 30);
  }, [library, query]);

  // Reset highlight when matches change.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const commit = (e: Exercise) => {
    onSelect({
      id: e.id,
      name: e.name,
      video_url: e.video_url,
      description: e.description,
    });
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = matches[activeIdx];
      if (m) commit(m);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const heightClass = size === "sm" ? "h-8" : "h-9";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 border border-border rounded-md bg-white px-2 ${heightClass}`}
      >
        <Search size={14} className="text-muted-foreground shrink-0" />
        {value && !open ? (
          // Show the selected exercise as a chip; clicking it re-opens the
          // search so the coach can change his mind.
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex-1 text-left text-sm font-semibold truncate"
          >
            {value}
          </button>
        ) : (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "Search the library…"}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        )}
        {value && onClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setQuery("");
            }}
            className="text-muted-foreground hover:text-red-600 shrink-0"
            title="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              No match. The exercise name must exist in the canonical library
              (Bibliothèque). Add it there first.
            </p>
          ) : (
            <ul>
              {matches.map((m, idx) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // mousedown fires before blur so the popover doesn't
                      // close before our click handler runs.
                      e.preventDefault();
                      commit(m);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${
                      idx === activeIdx ? "bg-accent/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-semibold truncate">{m.name}</span>
                    {m.tags && m.tags[0] && (
                      <span className="text-[10px] text-muted-foreground shrink-0 max-w-[40%] truncate">
                        {m.tags[0]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseSearchPopover;
