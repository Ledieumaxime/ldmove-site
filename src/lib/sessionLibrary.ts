// Shared data layer for the coach's session library: every session
// (program_weeks row) across every client's custom block, active and
// archived. Used by the "Import a session" dialog in the program
// editor and by the /app/admin/sessions browse page, so both always
// show the same thing. Read-only: the library is just a view over the
// existing blocks, nothing to maintain.

import { sbGetAll } from "@/integrations/supabase/api";

export type SessionLibraryEntry = {
  weekId: string;
  weekNumber: number;
  sessionTitle: string | null;
  programId: string;
  programTitle: string;
  programArchived: boolean;
  programCreatedAt: string;
  clientName: string;
  itemCount: number;
};

type WeekRow = {
  id: string;
  week_number: number;
  title: string | null;
  program: {
    id: string;
    title: string;
    is_archived: boolean;
    created_at: string;
    type: string;
    client: { first_name: string | null; email: string } | null;
  } | null;
};

export async function fetchSessionLibrary(): Promise<SessionLibraryEntry[]> {
  const [weeks, counts] = await Promise.all([
    sbGetAll<WeekRow>(
      // profiles is referenced twice from programs (assigned client +
      // owner coach): the fkey hint picks the client side.
      `program_weeks?select=id,week_number,title,` +
        `program:programs!inner(id,title,is_archived,created_at,type,` +
        `client:profiles!programs_assigned_client_id_fkey(first_name,email))` +
        `&program.type=eq.custom`
    ),
    sbGetAll<{ week_id: string }>(`program_items?select=week_id`),
  ]);
  const countByWeek = new Map<string, number>();
  for (const c of counts)
    countByWeek.set(c.week_id, (countByWeek.get(c.week_id) ?? 0) + 1);

  return weeks
    .filter((w) => w.program)
    .map((w) => ({
      weekId: w.id,
      weekNumber: w.week_number,
      sessionTitle: w.title,
      programId: w.program!.id,
      programTitle: w.program!.title,
      programArchived: w.program!.is_archived,
      programCreatedAt: w.program!.created_at,
      clientName:
        w.program!.client?.first_name?.trim() ||
        w.program!.client?.email ||
        "Unassigned",
      itemCount: countByWeek.get(w.id) ?? 0,
    }))
    .sort((a, b) =>
      a.programCreatedAt === b.programCreatedAt
        ? a.weekNumber - b.weekNumber
        : a.programCreatedAt < b.programCreatedAt
          ? 1
          : -1
    );
}

/** Distinct client names present in the library, for the filter dropdown. */
export function libraryClientNames(entries: SessionLibraryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.clientName))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Search (session / block / client name) + optional client filter.
 *  Empty sessions are hidden: nothing to look at or copy. */
export function filterSessionLibrary(
  entries: SessionLibraryEntry[],
  query: string,
  clientFilter: string
): SessionLibraryEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (e.itemCount === 0) return false;
    if (clientFilter && e.clientName !== clientFilter) return false;
    if (!q) return true;
    return (
      (e.sessionTitle ?? "").toLowerCase().includes(q) ||
      e.programTitle.toLowerCase().includes(q) ||
      e.clientName.toLowerCase().includes(q)
    );
  });
}

export function sessionDisplayName(e: SessionLibraryEntry): string {
  return e.sessionTitle?.trim() || `Session ${e.weekNumber}`;
}
