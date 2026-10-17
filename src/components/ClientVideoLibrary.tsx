import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Video } from "lucide-react";
import { sbGetAll, sbGetIn, sbSignUrl } from "@/integrations/supabase/api";
import { Input } from "@/components/ui/input";
import LazyVideo from "@/components/LazyVideo";
import { stripSection } from "@/components/ProgramItemCard";

/**
 * Every form check a client ever sent, filed by exercise, across all their
 * blocks. Built for the moment the coach writes the next block: "have they
 * already filmed this, and was it clean enough to move on?" The inbox could
 * not answer that, its archive mixes every client in one list by date.
 *
 * Videos from blocks archived before 2026-10-17 were deleted at archive
 * time; their row, the client's note and the coach's reply are still here.
 */

type Check = {
  id: string;
  item_id: string | null;
  video_url: string | null;
  client_note: string | null;
  coach_feedback: string | null;
  created_at: string;
  archived_as_progress: boolean;
};
type ItemRow = {
  id: string;
  custom_name: string | null;
  exercise_id: string | null;
  week_id: string;
};
type Reply = { item_id: string; body: string; created_at: string };
type Entry = Check & { block: string | null; reply: string | null };
type Group = { key: string; name: string; entries: Entry[] };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ClientVideoLibrary = ({ clientId }: { clientId: string }) => {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  // null = signing failed, undefined = not asked yet
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  // Read on first open only: a client with a long history has hundreds
  // of rows, and the page should not pay for them until they are wanted.
  useEffect(() => {
    if (!open || groups) return;
    let cancelled = false;
    (async () => {
      try {
        const checks = await sbGetAll<Check>(
          `form_check_submissions?select=id,item_id,video_url,client_note,coach_feedback,created_at,archived_as_progress` +
            `&client_id=eq.${clientId}&order=created_at.desc`
        );
        const itemIds = [
          ...new Set(checks.map((c) => c.item_id).filter(Boolean)),
        ] as string[];
        const items = itemIds.length
          ? await sbGetIn<ItemRow>(
              "program_items?select=id,custom_name,exercise_id,week_id",
              "id",
              itemIds
            )
          : [];
        const weekIds = [...new Set(items.map((i) => i.week_id))];
        const weeks = weekIds.length
          ? await sbGetIn<{ id: string; program_id: string }>(
              "program_weeks?select=id,program_id",
              "id",
              weekIds
            )
          : [];
        const programIds = [...new Set(weeks.map((w) => w.program_id))];
        const exerciseIds = [
          ...new Set(items.map((i) => i.exercise_id).filter(Boolean)),
        ] as string[];
        const [programs, exercises, replies] = await Promise.all([
          sbGetIn<{ id: string; title: string }>(
            "programs?select=id,title",
            "id",
            programIds
          ),
          sbGetIn<{ id: string; name: string }>(
            "exercises?select=id,name",
            "id",
            exerciseIds
          ),
          sbGetIn<Reply>(
            "exercise_comments?select=item_id,body,created_at&author_role=eq.coach",
            "item_id",
            itemIds
          ),
        ]);
        if (cancelled) return;

        const itemById = new Map(items.map((i) => [i.id, i]));
        const programOfWeek = new Map(weeks.map((w) => [w.id, w.program_id]));
        const titleOf = new Map(programs.map((p) => [p.id, p.title]));
        const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));

        // The coach's answer to a video is the first coach comment on the
        // same exercise posted after it, and before the next video on it.
        const checksByItem = new Map<string, Check[]>();
        for (const c of checks) {
          if (!c.item_id) continue;
          const list = checksByItem.get(c.item_id) ?? [];
          list.push(c);
          checksByItem.set(c.item_id, list);
        }
        const repliesByItem = new Map<string, Reply[]>();
        for (const r of [...replies].sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        )) {
          const list = repliesByItem.get(r.item_id) ?? [];
          list.push(r);
          repliesByItem.set(r.item_id, list);
        }
        const replyFor = (c: Check): string | null => {
          if (c.coach_feedback?.trim()) return c.coach_feedback.trim();
          if (!c.item_id) return null;
          const next = (checksByItem.get(c.item_id) ?? [])
            .filter((o) => o.created_at > c.created_at)
            .map((o) => o.created_at)
            .sort()[0];
          const r = (repliesByItem.get(c.item_id) ?? []).find(
            (x) => x.created_at >= c.created_at && (!next || x.created_at < next)
          );
          return r?.body?.trim() || null;
        };

        // Filed under the library name when there is one, so the same
        // exercise in Block 1 and Block 5 lands in one place.
        const byKey = new Map<string, Group>();
        for (const c of checks) {
          const item = c.item_id ? itemById.get(c.item_id) : undefined;
          const name = item
            ? (item.exercise_id && exerciseName.get(item.exercise_id)) ||
              stripSection(item.custom_name)
            : "Exercise no longer in a block";
          const key = item ? normalize(name) : "~removed";
          const group = byKey.get(key) ?? { key, name, entries: [] };
          group.entries.push({
            ...c,
            block: item
              ? titleOf.get(programOfWeek.get(item.week_id) ?? "") ?? null
              : null,
            reply: replyFor(c),
          });
          byKey.set(key, group);
        }
        // Most recently filmed first; videos newest first inside each.
        const out = [...byKey.values()].sort((a, b) =>
          b.entries[0].created_at.localeCompare(a.entries[0].created_at)
        );
        setGroups(out);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, groups, clientId]);

  const toggleGroup = (g: Group) => {
    const next = openKey === g.key ? null : g.key;
    setOpenKey(next);
    if (!next) return;
    // Sign only the videos of the exercise being opened.
    for (const e of g.entries) {
      if (!e.video_url || e.id in urls) continue;
      sbSignUrl("form-checks", e.video_url, 6 * 3600).then((u) =>
        setUrls((prev) => ({ ...prev, [e.id]: u }))
      );
    }
  };

  const filtered = useMemo(() => {
    if (!groups) return [];
    const q = normalize(query);
    return q ? groups.filter((g) => normalize(g.name).includes(q)) : groups;
  }, [groups, query]);

  const total = groups?.reduce((n, g) => n + g.entries.length, 0) ?? 0;

  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h2 className="font-heading text-base font-bold flex items-center gap-2">
          <Video size={16} /> Videos by exercise
          {groups && (
            <span className="text-[11px] font-normal text-muted-foreground">
              ({total})
            </span>
          )}
        </h2>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-4 border-t border-border pt-4 space-y-3">
          {error && (
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          )}
          {!groups && !error && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {groups && groups.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No form check sent yet.
            </p>
          )}
          {groups && groups.length > 6 && (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an exercise"
              className="h-8 text-sm"
            />
          )}
          <ul className="space-y-2">
            {filtered.map((g) => {
              const isOpen = openKey === g.key;
              const n = g.entries.length;
              return (
                <li key={g.key} className="border border-border rounded-xl">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold truncate">
                        {g.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {n} video{n > 1 ? "s" : ""} · last{" "}
                        {formatDate(g.entries[0].created_at)}
                      </span>
                    </span>
                    {isOpen ? (
                      <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <ul className="space-y-4 px-3 pb-3">
                      {g.entries.map((e) => (
                        <li key={e.id} className="space-y-1.5">
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(e.created_at)}
                            {e.block ? ` · ${e.block}` : ""}
                            {e.archived_as_progress ? " · Progress" : ""}
                          </p>
                          {!e.video_url ? (
                            <p className="text-[11px] text-muted-foreground italic">
                              Video deleted when its block was archived.
                            </p>
                          ) : urls[e.id] ? (
                            <LazyVideo
                              src={urls[e.id] as string}
                              className="w-full rounded-lg bg-black"
                            />
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              {urls[e.id] === null
                                ? "Could not load the video."
                                : "Loading video…"}
                            </p>
                          )}
                          {e.client_note?.trim() && (
                            <p className="text-xs">
                              <span className="font-semibold">Client: </span>
                              {e.client_note.trim()}
                            </p>
                          )}
                          {e.reply && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              <span className="font-semibold text-foreground">
                                Your reply:{" "}
                              </span>
                              {e.reply}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default ClientVideoLibrary;
