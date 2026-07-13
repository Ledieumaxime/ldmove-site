import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { ClientDashboardBody } from "@/pages/app/ClientDashboard";

type ClientProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

/**
 * Coach-side mirror of a client's dashboard. Renders the exact same
 * body component the client sees on /app/home, in read-only mode (no
 * Start button, no notifications, no onboarding banners), so the coach
 * can check streak / block progress / last session before a call.
 */
const AdminClientDashboard = () => {
  const { id } = useParams();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const rows = await sbGet<ClientProfile[]>(
          `profiles?id=eq.${id}&select=id,first_name,last_name,email`
        );
        setClient(rows[0] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!id || !client)
    return <div className="text-muted-foreground">Client not found.</div>;

  const name = client.first_name?.trim() || client.email;

  return (
    <div className="space-y-5">
      <Link
        to={`/app/admin/clients/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to {name}'s page
      </Link>

      <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
        <Eye size={16} className="text-accent shrink-0" />
        <p>
          <span className="font-semibold">Viewing as {name}.</span> This is
          exactly what they see on their dashboard. Read-only.
        </p>
      </div>

      <ClientDashboardBody
        clientId={id}
        firstName={client.first_name ?? ""}
        coachView
      />
    </div>
  );
};

export default AdminClientDashboard;
