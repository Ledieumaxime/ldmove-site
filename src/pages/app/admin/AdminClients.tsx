import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { sbGet, sbGetAll } from "@/integrations/supabase/api";
import BackToDashboard from "@/components/BackToDashboard";

/**
 * The roster: every client the coach has, in one place.
 *
 * The dashboard used to carry three lists at once — who needs attention,
 * who has no block running, who is gone. Only the first is a thing to
 * act on today; the other two are things you look up. Keeping them there
 * meant scrolling past two panels to reach the work.
 */

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string;
  archived_at: string | null;
  archive_reason: string | null;
};

type Program = {
  id: string;
  title: string;
  assigned_client_id: string | null;
  is_published: boolean;
  is_archived: boolean;
  created_at: string;
};

type Row = {
  client: Client;
  /** The block they are training now, or the last one they trained. */
  block: string | null;
  blockIsCurrent: boolean;
  lastSession: string | null;
};

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

const daysSince = (iso: string | null) =>
  iso == null
    ? null
    : Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const AdminClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [lastByClient, setLastByClient] = useState<Map<string, string>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      sbGet<Client[]>(
        "profiles?role=eq.client&select=id,first_name,last_name,email,created_at,archived_at,archive_reason&order=first_name.asc"
      ),
      // sbGetAll, not sbGet: PostgREST caps a plain read at 1000 rows
      // whatever the limit asks for, and a coach-wide fetch crosses that.
      sbGetAll<Program>(
        "programs?select=id,title,assigned_client_id,is_published,is_archived,created_at&type=eq.custom"
      ),
      sbGetAll<{ client_id: string; session_date: string }>(
        "workout_logs?select=client_id,session_date&completed_at=not.is.null"
      ),
    ])
      .then(([c, p, logs]) => {
        setClients(c);
        setPrograms(p);
        const last = new Map<string, string>();
        for (const l of logs) {
          const seen = last.get(l.client_id);
          if (!seen || l.session_date > seen) last.set(l.client_id, l.session_date);
        }
        setLastByClient(last);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const { active, idle, archived } = useMemo(() => {
    const byClient = new Map<string, Program[]>();
    for (const p of programs) {
      if (!p.assigned_client_id) continue;
      if (!byClient.has(p.assigned_client_id))
        byClient.set(p.assigned_client_id, []);
      byClient.get(p.assigned_client_id)!.push(p);
    }

    const toRow = (c: Client): Row => {
      const mine = (byClient.get(c.id) ?? []).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      const current = mine.find((p) => p.is_published && !p.is_archived);
      const fallback = mine[0];
      return {
        client: c,
        block: (current ?? fallback)?.title ?? null,
        blockIsCurrent: Boolean(current),
        lastSession: lastByClient.get(c.id) ?? null,
      };
    };

    const active: Row[] = [];
    const idle: Row[] = [];
    const archived: Row[] = [];
    for (const c of clients) {
      const row = toRow(c);
      if (c.archived_at) archived.push(row);
      else if (row.blockIsCurrent) active.push(row);
      else idle.push(row);
    }

    // Quiet longest first among the active: that is the one to chase.
    active.sort(
      (a, b) => (a.lastSession ?? "").localeCompare(b.lastSession ?? "")
    );
    // Newest arrivals first among the idle: a client with no block yet is
    // usually someone who just signed up and is waiting on a program.
    idle.sort((a, b) =>
      b.client.created_at.localeCompare(a.client.created_at)
    );
    archived.sort((a, b) =>
      (b.client.archived_at ?? "").localeCompare(a.client.archived_at ?? "")
    );
    return { active, idle, archived };
  }, [clients, programs, lastByClient]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading clients…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboard />

      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          Clients
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          {clients.length} client{clients.length === 1 ? "" : "s"}
        </h1>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Group
        title="Active"
        caption="training a published block"
        rows={active}
        emptyText="Nobody is on a block right now."
      />
      <Group
        title="No active block"
        caption="signed up, or between blocks"
        rows={idle}
        emptyText="Everyone has a block."
      />
      <Group
        title="Archived"
        caption="no longer coached"
        rows={archived}
        emptyText="No archived clients."
        muted
      />
    </div>
  );
};

const Group = ({
  title,
  caption,
  rows,
  emptyText,
  muted = false,
}: {
  title: string;
  caption: string;
  rows: Row[];
  emptyText: string;
  muted?: boolean;
}) => (
  <section className="bg-white rounded-2xl border border-border p-5">
    <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
      <h2
        className={`font-heading text-xl font-bold ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {title}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {rows.length}
        </span>
      </h2>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>

    {rows.length === 0 ? (
      <p className="text-sm text-muted-foreground italic">{emptyText}</p>
    ) : (
      <ul className="divide-y divide-border">
        {rows.map(({ client, block, blockIsCurrent, lastSession }) => {
          const quiet = daysSince(lastSession);
          return (
            <li key={client.id}>
              <Link
                to={`/app/admin/clients/${client.id}`}
                className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold">
                  {(client.first_name ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">
                    {client.first_name} {client.last_name}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {block
                      ? blockIsCurrent
                        ? block
                        : `last block: ${block}`
                      : client.email}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  {client.archived_at ? (
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(client.archived_at)}
                    </span>
                  ) : lastSession ? (
                    <>
                      <span
                        className={`block text-xs font-semibold ${
                          quiet != null && quiet >= 7
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {quiet === 0
                          ? "today"
                          : `${quiet}d ago`}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        last session
                      </span>
                    </>
                  ) : (
                    <span className="block text-xs text-muted-foreground">
                      never trained
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export default AdminClients;
