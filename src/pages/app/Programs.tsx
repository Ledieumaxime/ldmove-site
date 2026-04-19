import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, CheckCircle2, Play } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";

// removed unused state: was used for archived toggle

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  type: "catalogue" | "custom";
  price_eur: number;
  billing_type: "one_time" | "subscription";
  duration_weeks: number | null;
  assigned_client_id: string | null;
  is_published: boolean;
  is_archived: boolean;
};

type Enrollment = {
  id: string;
  program_id: string;
  status: "pending" | "paid" | "active" | "completed" | "canceled";
};

const Programs = () => {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, e] = await Promise.all([
          sbGet<Program[]>("programs?select=*&order=created_at.desc"),
          user ? sbGet<Enrollment[]>(`enrollments?select=*&client_id=eq.${user.id}`) : Promise.resolve([]),
        ]);
        setPrograms(p);
        setEnrollments(e);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return <div className="text-muted-foreground">Loading programs…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        Error: {error}
      </div>
    );
  }

  const getEnrollment = (pid: string) => enrollments.find((e) => e.program_id === pid);
  const catalogue = programs.filter(
    (p) => p.type === "catalogue" && p.is_published && !p.is_archived
  );

  return (
    <div className="space-y-6">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Catalogue</h1>
        <p className="text-muted-foreground">
          Browse the LD Move programs you can buy.
        </p>
      </div>

      {catalogue.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-white border border-border rounded-xl p-5">
          No programs in the catalogue yet.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {catalogue.map((p) => (
            <ProgramCard key={p.id} program={p} enrollment={getEnrollment(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

const ProgramCard = ({
  program,
  enrollment,
}: {
  program: Program;
  enrollment: Enrollment | undefined;
}) => {
  const isPaid = enrollment?.status === "paid" || enrollment?.status === "active" || enrollment?.status === "completed";
  const openAccess = program.is_archived; // archived programs = free access
  const unlocked = openAccess || isPaid;
  const Icon = unlocked ? CheckCircle2 : Lock;
  const badge = openAccess
    ? { label: "Archived — free", cls: "bg-gray-100 text-gray-700" }
    : unlocked
    ? { label: "Unlocked", cls: "bg-green-100 text-green-700" }
    : { label: `${program.price_eur}€`, cls: "bg-accent/10 text-accent" };

  return (
    <Link
      to={`/app/programs/${program.slug}`}
      className="bg-white rounded-2xl border border-border p-5 hover:border-accent/40 hover:shadow-md transition block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Play className="text-accent" size={18} />
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}`}>
          <Icon size={12} className="inline mr-1" />
          {badge.label}
        </span>
      </div>
      <h3 className="font-heading text-lg font-bold mb-1">{program.title}</h3>
      {program.description && (
        <p className="text-sm text-muted-foreground line-clamp-3">{program.description}</p>
      )}
      {program.duration_weeks && (
        <p className="text-xs text-muted-foreground mt-3">
          {program.duration_weeks} weeks
        </p>
      )}
    </Link>
  );
};

export default Programs;
