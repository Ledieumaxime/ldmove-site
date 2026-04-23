import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Eye, Users, Tag, Archive, ArchiveRestore } from "lucide-react";
import { sbGet, sbPatch } from "@/integrations/supabase/api";
import { cleanupArchivedVideos } from "@/integrations/supabase/notify";
import { Button } from "@/components/ui/button";
import BackToDashboard from "@/components/BackToDashboard";

type Program = {
  id: string;
  slug: string;
  title: string;
  type: "catalogue" | "custom";
  price_eur: number;
  billing_type: "one_time" | "subscription";
  duration_weeks: number | null;
  is_published: boolean;
  is_archived: boolean;
  assigned_client_id: string | null;
  created_at: string;
};

const AdminPrograms = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"custom" | "catalogue" | "archived" | "draft" | "all">("custom");

  useEffect(() => {
    sbGet<Program[]>("programs?select=*&order=created_at.desc")
      .then(setPrograms)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = programs.filter((p) => {
    if (filter === "all") return true;
    if (filter === "archived") return p.is_archived;
    if (filter === "draft") return !p.is_published;
    return p.type === filter && !p.is_archived;
  });

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">Admin · Programs</h1>
          <p className="text-muted-foreground text-sm">
            Create, edit and publish your programs.
          </p>
        </div>
        <Link to="/app/admin/programs/new">
          <Button className="gap-2">
            <Plus size={16} /> New program
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["custom", "1:1"],
            ["catalogue", "Catalogue"],
            ["archived", "Archived"],
            ["draft", "Draft"],
            ["all", "All"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${
              filter === k
                ? "bg-foreground text-background border-foreground"
                : "bg-white border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground">No programs in this category.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Type</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {p.type === "catalogue" ? <Tag size={12} /> : <Users size={12} />}
                      {p.type === "catalogue" ? "Catalogue" : "1:1"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.price_eur}€
                    {p.billing_type === "subscription" && "/mo"}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_archived ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        Archived
                      </span>
                    ) : p.is_published ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={async () => {
                        const archiving = !p.is_archived;
                        await sbPatch(`programs?id=eq.${p.id}`, {
                          is_archived: archiving,
                        });
                        setPrograms((prev) =>
                          prev.map((x) =>
                            x.id === p.id ? { ...x, is_archived: archiving } : x
                          )
                        );
                        // Clean up form-check videos when archiving
                        if (archiving) {
                          cleanupArchivedVideos(p.id).catch(() => undefined);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mr-3"
                      title={p.is_archived ? "Unarchive" : "Archive"}
                    >
                      {p.is_archived ? (
                        <>
                          <ArchiveRestore size={14} /> Unarchive
                        </>
                      ) : (
                        <>
                          <Archive size={14} /> Archive
                        </>
                      )}
                    </button>
                    <Link
                      to={`/app/programs/${p.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mr-3"
                    >
                      <Eye size={14} /> View
                    </Link>
                    <Link
                      to={`/app/admin/programs/${p.id}/edit`}
                      className="inline-flex items-center gap-1 text-xs text-accent font-semibold hover:underline"
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPrograms;
