import { useEffect, useMemo, useState } from "react";
import { sbGet, sbGetIn } from "@/integrations/supabase/api";

// Training calendar for one block. Month grids with the day numbers,
// every day the client trained filled in the accent, two-session days
// in a darker shade. The header answers the question the coach cares
// about at block review: how long did this block actually run, and how
// many sessions went in.
//
// Its real job is not reporting, it's pressure: an empty grid is the
// most legible way to tell a client they have not logged anything.

type BlockOption = {
  id: string;
  title: string;
  isCurrent: boolean;
};

type LogRow = {
  program_item_id: string;
  session_run_id: string;
  session_date: string;
  completed_at: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const parseISO = (s: string) => new Date(s + "T12:00:00");
/** Monday = 0 … Sunday = 6, matching the grid's column order. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** Distinct completed sessions per calendar day. */
export function sessionsPerDay(logs: LogRow[]): Map<string, number> {
  const runs = new Map<string, string>(); // run id → date
  for (const l of logs) {
    if (!l.completed_at) continue;
    if (!runs.has(l.session_run_id)) runs.set(l.session_run_id, l.session_date);
  }
  const perDay = new Map<string, number>();
  for (const date of runs.values())
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
  return perDay;
}

const BlockCalendar = ({
  clientId,
  blocks,
  currentLogs,
}: {
  clientId: string;
  /** Every custom block of this client, newest first. */
  blocks: BlockOption[];
  /** Logs already loaded for the current block, so the default view
   *  costs no extra request. */
  currentLogs: LogRow[];
}) => {
  const current = blocks.find((b) => b.isCurrent) ?? blocks[0];
  const [selectedId, setSelectedId] = useState(current?.id ?? "");
  const [logsById, setLogsById] = useState<Record<string, LogRow[]>>(
    current ? { [current.id]: currentLogs } : {}
  );
  const [loading, setLoading] = useState(false);

  // Past blocks are fetched only when the client asks for them.
  useEffect(() => {
    if (!selectedId || logsById[selectedId]) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const weeks = await sbGet<{ id: string }[]>(
          `program_weeks?program_id=eq.${selectedId}&select=id`
        );
        const items =
          weeks.length > 0
            ? await sbGetIn<{ id: string }>(
                `program_items?select=id`,
                "week_id",
                weeks.map((w) => w.id)
              )
            : [];
        const logs =
          items.length > 0
            ? await sbGetIn<LogRow>(
                `workout_logs?client_id=eq.${clientId}&completed_at=not.is.null&select=program_item_id,session_run_id,session_date,completed_at`,
                "program_item_id",
                items.map((i) => i.id)
              )
            : [];
        if (!cancelled)
          setLogsById((prev) => ({ ...prev, [selectedId]: logs }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, clientId, logsById]);

  const selected = blocks.find((b) => b.id === selectedId);
  const logs = logsById[selectedId];

  const view = useMemo(() => {
    if (!logs) return null;
    const perDay = sessionsPerDay(logs);
    const dates = [...perDay.keys()].sort();
    if (dates.length === 0) return { perDay, empty: true as const };
    const first = parseISO(dates[0]);
    // A running block is measured up to today, so the gap since the
    // last session is visible. A finished one stops at its last day.
    const lastTrained = parseISO(dates[dates.length - 1]);
    const today = parseISO(toISO(new Date()));
    const last =
      selected?.isCurrent && today > lastTrained ? today : lastTrained;
    const days =
      Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
    const sessions = [...perDay.values()].reduce((n, v) => n + v, 0);

    // One entry per month touched by the block.
    const months: { year: number; month: number }[] = [];
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    const end = new Date(last.getFullYear(), last.getMonth(), 1);
    while (cursor <= end) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return {
      perDay,
      empty: false as const,
      firstISO: dates[0],
      lastISO: toISO(last),
      days,
      sessions,
      months,
    };
  }, [logs, selected?.isCurrent]);

  if (!current) return null;

  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Training calendar
        </span>
        {blocks.length > 1 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-8 rounded-md border border-input bg-white px-2 text-xs max-w-[60%]"
          >
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
                {b.isCurrent ? " · current" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading || !view ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : view.empty ? (
        <p className="text-sm text-muted-foreground py-4">
          No session logged on this block yet. Every session you complete
          fills a day here.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 pb-3 mb-3 border-b border-border">
            <span className="font-heading text-2xl font-bold">
              {view.days}
            </span>
            <span className="text-sm text-muted-foreground">days</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-heading text-2xl font-bold">
              {view.sessions}
            </span>
            <span className="text-sm text-muted-foreground">sessions</span>
          </div>

          <div className="space-y-4">
            {view.months.map(({ year, month }) => {
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const pad = mondayIndex(new Date(year, month, 1));
              // Build the month as week rows, then drop the rows that
              // fall entirely outside the block: a block starting on
              // the 16th would otherwise open on two empty weeks.
              const cells: (number | null)[] = [
                ...Array.from({ length: pad }, () => null),
                ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
              ];
              const rows: (number | null)[][] = [];
              for (let i = 0; i < cells.length; i += 7)
                rows.push(cells.slice(i, i + 7));
              const visibleRows = rows.filter((row) =>
                row.some((day) => {
                  if (day == null) return false;
                  const iso = toISO(new Date(year, month, day));
                  return iso >= view.firstISO && iso <= view.lastISO;
                })
              );
              if (visibleRows.length === 0) return null;
              return (
                <div key={`${year}-${month}`}>
                  <p className="text-sm font-semibold mb-2">
                    {MONTHS[month]}
                    {view.months[0].year === year &&
                    view.months[0].month === month
                      ? ` ${year}`
                      : ""}
                  </p>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {DOW.map((d, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-muted-foreground"
                      >
                        {d}
                      </span>
                    ))}
                    {visibleRows.flat().map((day, idx) => {
                      if (day == null) return <span key={`pad-${idx}`} />;
                      const iso = toISO(new Date(year, month, day));
                      const count = view.perDay.get(iso) ?? 0;
                      const inBlock =
                        iso >= view.firstISO && iso <= view.lastISO;
                      const base =
                        "text-[11px] rounded-md py-1.5 leading-none";
                      if (count >= 2)
                        return (
                          <span
                            key={iso}
                            className={`${base} bg-accent brightness-75 text-white font-semibold`}
                            title={`${count} sessions`}
                          >
                            {day}
                          </span>
                        );
                      if (count === 1)
                        return (
                          <span
                            key={iso}
                            className={`${base} bg-accent text-white font-semibold`}
                            title="1 session"
                          >
                            {day}
                          </span>
                        );
                      if (inBlock)
                        return (
                          <span
                            key={iso}
                            className={`${base} bg-muted text-muted-foreground`}
                          >
                            {day}
                          </span>
                        );
                      return (
                        <span
                          key={iso}
                          className={`${base} text-muted-foreground/30`}
                        >
                          {day}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded-sm bg-accent inline-block" /> 1
              session
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded-sm bg-accent brightness-75 inline-block" />{" "}
              2 sessions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-3 h-3 rounded-sm bg-muted inline-block" /> rest
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default BlockCalendar;
