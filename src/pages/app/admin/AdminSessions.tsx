import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Library } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { Input } from "@/components/ui/input";
import BackToDashboard from "@/components/BackToDashboard";
import { stripSection } from "@/components/ProgramItemCard";
import {
  SessionLibraryEntry,
  fetchSessionLibrary,
  filterSessionLibrary,
  libraryClientNames,
  sessionDisplayName,
} from "@/lib/sessionLibrary";

// The coach's session library: every session of every custom block
// (active and archived), searchable. Read-only memory of everything
// ever prescribed; to copy a session into a client's block, use the
// Import button inside that block's editor.

type SessionItem = {
  id: string;
  custom_name: string | null;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  group_name: string | null;
  order_index: number;
};

const sectionOf = (name: string | null): string => {
  const m = (name ?? "").match(/^\[([^\]]+)\]/);
  return m ? m[1].trim().toUpperCase() : "EXERCISES";
};

const AdminSessions = () => {
  const [entries, setEntries] = useState<SessionLibraryEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsByWeek, setItemsByWeek] = useState<Record<string, SessionItem[]>>(
    {}
  );

  useEffect(() => {
    fetchSessionLibrary()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const toggle = async (weekId: string) => {
    if (expanded === weekId) {
      setExpanded(null);
      return;
    }
    setExpanded(weekId);
    if (!itemsByWeek[weekId]) {
      try {
        const rows = await sbGet<SessionItem[]>(
          `program_items?week_id=eq.${weekId}&select=id,custom_name,sets,reps,rest_seconds,notes,group_name,order_index&order=order_index.asc`
        );
        setItemsByWeek((prev) => ({ ...prev, [weekId]: rows }));
      } catch {
        setItemsByWeek((prev) => ({ ...prev, [weekId]: [] }));
      }
    }
  };

  const visible = filterSessionLibrary(entries ?? [], query, clientFilter);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <BackToDashboard />

      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold flex items-center gap-2">
          <Library size={26} /> Sessions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every session you've ever built, across all clients and blocks
          (archived included). Open one to see the full prescription. To
          reuse a session, open the client's block editor and click Import.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a session, block or client…"
          className="h-10 text-sm bg-white"
        />
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-white px-2 text-sm shrink-0 max-w-[40%]"
        >
          <option value="">All clients</option>
          {libraryClientNames(entries ?? []).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {!entries ? (
        <p className="text-sm text-muted-foreground">Loading the library…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No session matches.</p>
      ) : (
        <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {visible.map((e) => (
            <div key={e.weekId}>
              <button
                type="button"
                onClick={() => toggle(e.weekId)}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 flex items-center justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">
                    {sessionDisplayName(e)}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {e.programTitle} · {e.clientName}
                    {e.programArchived ? " · archived" : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                  {e.itemCount} exercise{e.itemCount === 1 ? "" : "s"}
                  {expanded === e.weekId ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </span>
              </button>

              {expanded === e.weekId && (
                <div className="px-4 pb-4 bg-muted/20">
                  <SessionDetail items={itemsByWeek[e.weekId]} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SessionDetail = ({ items }: { items: SessionItem[] | undefined }) => {
  if (!items) {
    return <p className="text-xs text-muted-foreground pt-3">Loading…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground pt-3">
        This session is empty.
      </p>
    );
  }

  // Group consecutive items by section, then by group_name inside the
  // section, mirroring how the client-facing pages read the data.
  type Block = { group: string | null; items: SessionItem[] };
  type SectionBlock = { section: string; blocks: Block[] };
  const sections: SectionBlock[] = [];
  for (const it of items) {
    const sec = sectionOf(it.custom_name);
    let current = sections[sections.length - 1];
    if (!current || current.section !== sec) {
      current = { section: sec, blocks: [] };
      sections.push(current);
    }
    const gn = it.group_name?.trim() || null;
    const lastBlock = current.blocks[current.blocks.length - 1];
    if (gn && lastBlock && lastBlock.group === gn) {
      lastBlock.items.push(it);
    } else {
      current.blocks.push({ group: gn, items: [it] });
    }
  }

  const prescription = (it: SessionItem): string => {
    const parts: string[] = [];
    if (it.sets != null && it.reps) parts.push(`${it.sets}×${it.reps}`);
    else if (it.reps) parts.push(it.reps);
    else if (it.sets != null) parts.push(`${it.sets} sets`);
    if (it.rest_seconds != null && it.rest_seconds > 0)
      parts.push(`rest ${it.rest_seconds}s`);
    return parts.join(" · ");
  };

  return (
    <div className="space-y-3 pt-3">
      {sections.map((sec, sIdx) => (
        <div key={sIdx}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {sec.section}
          </p>
          <div className="space-y-1.5">
            {sec.blocks.map((block, bIdx) =>
              block.group ? (
                <div
                  key={bIdx}
                  className="border border-accent/30 rounded-lg p-2 bg-white"
                >
                  <p className="text-[10px] font-bold text-accent uppercase tracking-wide mb-1">
                    {block.group}
                    {(() => {
                      const rounds = block.items.find(
                        (i) => i.sets != null
                      )?.sets;
                      return rounds != null ? ` · ${rounds} rounds` : "";
                    })()}
                  </p>
                  {block.items.map((it, i) => (
                    <ItemLine
                      key={it.id}
                      index={i + 1}
                      name={stripSection(it.custom_name ?? "")}
                      right={it.reps ?? ""}
                      notes={it.notes}
                    />
                  ))}
                </div>
              ) : (
                block.items.map((it) => (
                  <div key={it.id} className="bg-white rounded-lg px-2 py-1.5">
                    <ItemLine
                      name={stripSection(it.custom_name ?? "")}
                      right={prescription(it)}
                      notes={it.notes}
                    />
                  </div>
                ))
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const ItemLine = ({
  index,
  name,
  right,
  notes,
}: {
  index?: number;
  name: string;
  right: string;
  notes: string | null;
}) => (
  <div className="py-0.5">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm truncate">
        {index != null && (
          <span className="text-muted-foreground mr-1.5">{index}.</span>
        )}
        {name || "Unnamed exercise"}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {right}
      </span>
    </div>
    {notes && (
      <p className="text-[11px] text-muted-foreground/80 truncate">{notes}</p>
    )}
  </div>
);

export default AdminSessions;
