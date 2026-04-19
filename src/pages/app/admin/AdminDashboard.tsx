import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Video, MessageCircle, Users, Dumbbell } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";

type Program = {
  id: string;
  title: string;
  slug: string;
  assigned_client_id: string | null;
  duration_weeks: number | null;
  created_at: string;
  is_published: boolean;
  is_archived: boolean;
  type: "catalogue" | "custom";
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type FormCheck = {
  id: string;
  status: "pending" | "reviewed";
  created_at: string;
  client_id: string;
  item_id: string | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
  program_items?: { custom_name: string | null } | null;
};

type Comment = {
  id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  item_id: string;
  profiles?: { first_name: string | null; last_name: string | null } | null;
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sbGet<Program[]>(
        "programs?select=*&type=eq.custom&is_archived=eq.false&is_published=eq.true&order=created_at.desc"
      ),
      sbGet<Profile[]>(
        "profiles?select=id,first_name,last_name,email&role=eq.client"
      ),
      sbGet<FormCheck[]>(
        "form_check_submissions?select=*,profiles(first_name,last_name),program_items(custom_name)&order=created_at.desc&limit=30"
      ),
      sbGet<Comment[]>(
        "exercise_comments?select=*,profiles(first_name,last_name)&order=created_at.desc&limit=200"
      ),
    ])
      .then(([p, c, f, co]) => {
        setPrograms(p);
        setClients(c);
        setChecks(f);
        setComments(co);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted-foreground">Loading dashboard…</div>;

  const now = Date.now();
  const pendingChecks = checks.filter((c) => c.status === "pending");
  const activeClientIds = new Set(
    programs.map((p) => p.assigned_client_id).filter(Boolean)
  );

  // Count unanswered threads: threads where the latest comment is from a client
  const latestByItem = new Map<string, Comment>();
  for (const c of comments) {
    if (!latestByItem.has(c.item_id)) latestByItem.set(c.item_id, c);
  }
  const unansweredThreadCount = Array.from(latestByItem.values()).filter(
    (c) => c.author_role === "client"
  ).length;

  // Progress per client program
  type ProgressEntry = {
    program: Program;
    client: Profile | undefined;
    progress: number;
    daysLeft: number;
    status: "active" | "ending" | "overdue";
  };
  const progressList: ProgressEntry[] = programs.map((p) => {
    const client = clients.find((c) => c.id === p.assigned_client_id);
    const start = new Date(p.created_at).getTime();
    const weeks = p.duration_weeks ?? 4;
    const end = start + weeks * 7 * 86_400_000;
    const progress = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
    const daysLeft = Math.ceil((end - now) / 86_400_000);
    const status: ProgressEntry["status"] =
      daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "ending" : "active";
    return { program: p, client, progress, daysLeft, status };
  });
  progressList.sort((a, b) => b.progress - a.progress);

  // Activity feed
  type Event = {
    kind: "form_check" | "comment";
    date: string;
    name: string;
    detail: string;
    link: string;
  };
  const events: Event[] = [];
  for (const c of checks.slice(0, 15)) {
    events.push({
      kind: "form_check",
      date: c.created_at,
      name: `${c.profiles?.first_name ?? "Client"} sent a form check`,
      detail: c.program_items?.custom_name ?? "Exercise",
      link: "/app/admin/form-checks",
    });
  }
  for (const c of comments.filter((c) => c.author_role === "client").slice(0, 15)) {
    events.push({
      kind: "comment",
      date: c.created_at,
      name: `${c.profiles?.first_name ?? "Client"} commented`,
      detail: c.body.slice(0, 100),
      link: "/app/admin/form-checks",
    });
  }
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          Coach Dashboard
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          Hi {profile?.first_name ?? "Coach"}
        </h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ClientReviewCard
          videos={pendingChecks.length}
          comments={unansweredThreadCount}
        />
        <StatCard
          label="Active clients"
          value={activeClientIds.size}
          icon={<Users size={18} />}
          to="/app/admin/clients"
        />
        <StatCard
          label="Active programs"
          value={programs.length}
          icon={<Dumbbell size={18} />}
          to="/app/admin/programs"
        />
      </div>

      {/* Client program progress */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <h2 className="font-heading text-xl font-bold mb-4">Client program progress</h2>
        {progressList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active client programs. Assign one from the <Link to="/app/admin/clients" className="text-accent hover:underline">Clients</Link> page.
          </p>
        ) : (
          <div className="space-y-3">
            {progressList.map((e) => (
              <Link
                key={e.program.id}
                to={`/app/admin/programs/${e.program.id}/edit`}
                className="block border border-border rounded-xl p-3 hover:border-accent/50 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {e.client?.first_name ?? "Unknown"} · {e.program.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.status === "overdue"
                        ? `⚠ Overdue by ${Math.abs(e.daysLeft)} day${Math.abs(e.daysLeft) > 1 ? "s" : ""} — time to renew`
                        : `${e.daysLeft} day${e.daysLeft > 1 ? "s" : ""} left · ${e.program.duration_weeks ?? "—"} weeks total`}
                    </p>
                  </div>
                  <span className="font-heading text-2xl font-bold">
                    {Math.round(e.progress)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      e.status === "overdue"
                        ? "bg-red-500"
                        : e.status === "ending"
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${e.progress}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Activity feed */}
      {events.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-heading text-xl font-bold mb-3">Recent activity</h2>
          <ul className="space-y-2">
            {events.slice(0, 10).map((e, i) => (
              <li key={i}>
                <Link
                  to={e.link}
                  className="flex items-start gap-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-2 -mx-2"
                >
                  <div className="mt-0.5">
                    {e.kind === "form_check" ? (
                      <Video size={14} className="text-muted-foreground" />
                    ) : (
                      <MessageCircle size={14} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{e.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.detail}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatRelative(e.date, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  to,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
  highlight?: boolean;
}) => (
  <Link
    to={to}
    className={`block rounded-2xl border p-4 hover:shadow-md transition ${
      highlight && value > 0
        ? "bg-accent/10 border-accent/40"
        : "bg-white border-border"
    }`}
  >
    <div className={`${highlight && value > 0 ? "text-accent" : "text-muted-foreground"} mb-1`}>
      {icon}
    </div>
    <p className="font-heading text-3xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </Link>
);

const ClientReviewCard = ({
  videos,
  comments,
}: {
  videos: number;
  comments: number;
}) => {
  const highlight = videos > 0 || comments > 0;
  return (
    <div
      className={`rounded-2xl border ${
        highlight ? "bg-accent/10 border-accent/40" : "bg-white border-border"
      }`}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-4 pt-4">
        Client review
      </p>
      <div className="grid grid-cols-2 divide-x divide-border">
        <Link
          to="/app/admin/form-checks#form-checks"
          className="flex flex-col items-center gap-1 py-3 hover:bg-white/50 transition"
        >
          <Video size={20} className={highlight && videos > 0 ? "text-accent" : "text-muted-foreground"} />
          <p className="font-heading text-2xl font-bold">{videos}</p>
          <p className="text-[11px] text-muted-foreground">videos</p>
        </Link>
        <Link
          to="/app/admin/form-checks#comments"
          className="flex flex-col items-center gap-1 py-3 hover:bg-white/50 transition"
        >
          <MessageCircle size={20} className={highlight && comments > 0 ? "text-accent" : "text-muted-foreground"} />
          <p className="font-heading text-2xl font-bold">{comments}</p>
          <p className="text-[11px] text-muted-foreground">comments</p>
        </Link>
      </div>
    </div>
  );
};

function formatRelative(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default AdminDashboard;
