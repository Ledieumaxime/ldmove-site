import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Play, ArrowLeft } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_weeks: number | null;
  created_at: string;
};

const ClientArchived = () => {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sbGet<Program[]>(
      `programs?select=id,slug,title,description,duration_weeks,created_at&type=eq.custom&assigned_client_id=eq.${user.id}&is_archived=eq.true&order=created_at.desc`
    )
      .then(setPrograms)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold flex items-center gap-2">
          <Archive size={24} /> Archived programs
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Free access to all the programs you've completed.
        </p>
      </div>

      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-white border border-border rounded-xl p-5">
          You don't have any archived programs yet.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {programs.map((p) => (
            <Link
              key={p.id}
              to={`/app/programs/${p.slug}`}
              className="bg-white rounded-2xl border border-border p-5 hover:border-accent/40 hover:shadow-md transition block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Play className="text-muted-foreground" size={18} />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Archived — free
                </span>
              </div>
              <h3 className="font-heading text-lg font-bold mb-1">{p.title}</h3>
              {p.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
              )}
              {p.duration_weeks && (
                <p className="text-xs text-muted-foreground mt-3">{p.duration_weeks} weeks</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientArchived;
