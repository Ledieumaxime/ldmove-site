import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, MessageCircle, Archive, ArrowRight, AlertCircle, ClipboardList } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "catalogue" | "custom";
  duration_weeks: number | null;
  created_at: string;
  is_archived: boolean;
  is_published: boolean;
  assigned_client_id: string | null;
};

type Comment = {
  id: string;
  item_id: string;
  author_id: string | null;
  author_role: "coach" | "client";
  body: string;
  created_at: string;
  program_items?: { custom_name: string | null; week_id: string | null } | null;
};

type CommentRead = { item_id: string; last_read_at: string };

type FormCheck = {
  id: string;
  status: "pending" | "reviewed";
  created_at: string;
};

const ClientDashboard = () => {
  const { profile, user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reads, setReads] = useState<CommentRead[]>([]);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [hasIntake, setHasIntake] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      sbGet<Program[]>(
        `programs?select=*&or=(type.eq.catalogue,and(type.eq.custom,assigned_client_id.eq.${user.id}))&order=created_at.desc`
      ),
      sbGet<Comment[]>(
        `exercise_comments?select=*,program_items(custom_name,week_id)&author_role=eq.coach&order=created_at.desc&limit=20`
      ),
      sbGet<CommentRead[]>(
        `comment_reads?select=item_id,last_read_at&user_id=eq.${user.id}`
      ),
      sbGet<FormCheck[]>(
        `form_check_submissions?select=id,status,created_at&client_id=eq.${user.id}&order=created_at.desc&limit=10`
      ),
      sbGet<Array<{ client_id: string }>>(
        `client_intakes?select=client_id&client_id=eq.${user.id}&limit=1`
      ),
    ])
      .then(([p, co, r, fc, intake]) => {
        setPrograms(p);
        setComments(co);
        setReads(r);
        setChecks(fc);
        setHasIntake(intake.length > 0);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  const now = Date.now();

  // Current active custom program (first non-archived published one)
  const currentProgram = programs.find(
    (p) =>
      p.type === "custom" &&
      p.assigned_client_id === user?.id &&
      !p.is_archived &&
      p.is_published
  );

  const archivedCount = programs.filter(
    (p) =>
      p.type === "custom" &&
      p.assigned_client_id === user?.id &&
      p.is_archived
  ).length;

  // Unread coach comments: coach comments whose created_at > user's last_read_at for that item
  const readsByItem = new Map(reads.map((r) => [r.item_id, r.last_read_at]));
  const unreadComments = comments.filter((c) => {
    const lastRead = readsByItem.get(c.item_id);
    if (!lastRead) return true;
    return new Date(c.created_at).getTime() > new Date(lastRead).getTime();
  });

  // Progress of current program
  let progress = 0;
  let daysLeft = 0;
  let isOverdue = false;
  if (currentProgram) {
    const start = new Date(currentProgram.created_at).getTime();
    const weeks = currentProgram.duration_weeks ?? 4;
    const end = start + weeks * 7 * 86_400_000;
    progress = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
    daysLeft = Math.ceil((end - now) / 86_400_000);
    isOverdue = daysLeft < 0;
  }

  const pendingChecks = checks.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Welcome</p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          Hi {profile?.first_name ?? ""}
        </h1>
      </div>

      {/* Onboarding banner — shown until intake is filled */}
      {!hasIntake && (
        <Link
          to="/app/onboarding/intake"
          className="block bg-accent/10 border-2 border-accent/40 text-foreground rounded-2xl p-5 hover:bg-accent/15 transition"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
              <ClipboardList size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider font-semibold text-accent">
                Start here
              </p>
              <h2 className="font-heading text-xl font-bold mt-0.5">
                Complete your intake form
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                5 minutes to tell me where you are today — this is what I use to design your first program.
              </p>
            </div>
            <ArrowRight size={20} className="text-accent shrink-0 mt-2" />
          </div>
        </Link>
      )}

      {/* Current program hero */}
      {currentProgram ? (
        <Link
          to={`/app/programs/${currentProgram.slug}`}
          className="block bg-foreground text-background rounded-2xl p-6 hover:opacity-95 transition"
        >
          <p className="text-xs uppercase tracking-wider opacity-70 font-semibold mb-1">
            Your current program
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
            {currentProgram.title}
          </h2>

          <div className="flex items-baseline justify-between mb-2">
            <span className="font-heading text-3xl font-bold">{Math.round(progress)}%</span>
            <span className="text-sm opacity-80">
              {isOverdue
                ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) > 1 ? "s" : ""}`
                : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`}
            </span>
          </div>
          <div className="h-2 bg-background/20 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full transition-all ${
                isOverdue ? "bg-red-400" : progress > 80 ? "bg-amber-400" : "bg-green-400"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            Continue <ArrowRight size={16} />
          </div>
        </Link>
      ) : (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-heading text-xl font-bold mb-2">No active program</h2>
          <p className="text-sm text-muted-foreground">
            Your coach hasn't assigned an active program yet. Check the catalogue below or get in touch.
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatCard
          label="Reply from your coach"
          value={unreadComments.length}
          icon={<MessageCircle size={18} />}
          to="/app/inbox"
          highlight={unreadComments.length > 0}
        />
        <StatCard
          label="Archived programs"
          value={archivedCount}
          icon={<Archive size={18} />}
          to="/app/archived"
        />
      </div>

      {/* Program ending / overdue warning */}
      {currentProgram && (isOverdue || daysLeft <= 7) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              {isOverdue
                ? "Your program has ended — time to check in with your coach"
                : `Your program ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`}
            </p>
            <p className="text-amber-800 mt-0.5">
              Drop a message in any exercise's comments and Maxime will pick it up.
            </p>
          </div>
        </div>
      )}

      {/* Recent coach messages */}
      {unreadComments.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-heading text-xl font-bold mb-3 flex items-center gap-2">
            <MessageCircle size={18} className="text-accent" />
            New from your coach
          </h2>
          <ul className="space-y-2">
            {unreadComments.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  to="/app/inbox#messages"
                  className="flex items-start gap-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-2 -mx-2"
                >
                  <Dumbbell size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {c.program_items?.custom_name
                        ?.replace(/^\[[^\]]+\]\s*/, "") ?? "Exercise"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.body}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatRelative(c.created_at, now)}
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

export default ClientDashboard;
