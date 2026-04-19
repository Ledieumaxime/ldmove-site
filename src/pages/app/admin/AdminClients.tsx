import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, UserPlus, Dumbbell, Calendar } from "lucide-react";
import { sbGet, sbPost } from "@/integrations/supabase/api";
import { notifyProgramPublished } from "@/integrations/supabase/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import BackToDashboard from "@/components/BackToDashboard";

type Client = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

type Program = {
  id: string;
  slug: string;
  title: string;
  type: "catalogue" | "custom";
  assigned_client_id: string | null;
  price_eur: number;
  billing_type: "one_time" | "subscription";
  is_published: boolean;
};

const AdminClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        sbGet<Client[]>("profiles?select=*&role=eq.client&order=created_at.desc"),
        sbGet<Program[]>("programs?select=*&order=created_at.desc"),
      ]);
      setClients(c);
      setPrograms(p);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const clientPrograms = (cid: string) =>
    programs.filter((p) => p.type === "custom" && p.assigned_client_id === cid);

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
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">Admin · Clients</h1>
        <p className="text-muted-foreground text-sm">
          All registered client accounts. Assign a 1:1 program to any of them.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground">
            No clients yet. Share your site — signups will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => {
            const progs = clientPrograms(c.id);
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white font-heading text-lg">
                      {c.first_name?.[0] ?? "?"}
                    </div>
                    <div>
                      <p className="font-heading text-lg font-bold">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail size={11} /> {c.email}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar size={11} /> Joined{" "}
                        {new Date(c.created_at).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setAssignOpen(assignOpen === c.id ? null : c.id)}
                  >
                    <UserPlus size={14} />
                    {assignOpen === c.id ? "Close" : "Assign a program"}
                  </Button>
                </div>

                {progs.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Assigned 1:1 programs
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {progs.map((p) => (
                        <Link
                          key={p.id}
                          to={`/app/admin/programs/${p.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent font-semibold px-3 py-1 rounded-full hover:bg-accent/20"
                        >
                          <Dumbbell size={11} />
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {assignOpen === c.id && (
                  <AssignForm
                    client={c}
                    onDone={() => {
                      setAssignOpen(null);
                      load();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AssignForm = ({
  client,
  onDone,
}: {
  client: Client;
  onDone: () => void;
}) => {
  const [title, setTitle] = useState(`1:1 Program — ${client.first_name ?? ""}`);
  const [description, setDescription] = useState("");
  const [priceEur, setPriceEur] = useState(120);
  const [billingType, setBillingType] = useState<"one_time" | "subscription">("subscription");
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const slug = `1-1-${client.first_name?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "client"}-${Date.now().toString(36)}`;
    try {
      const created = await sbPost<{ id: string }[]>("programs", {
        slug,
        title,
        description,
        type: "custom",
        assigned_client_id: client.id,
        price_eur: priceEur,
        billing_type: billingType,
        duration_weeks: durationWeeks,
        is_published: true,
      });
      const newId = created[0]?.id;
      if (newId && confirm("Send the 'new program' email to the client now?")) {
        await notifyProgramPublished(newId);
      }
      onDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-border pt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">
        Create a 1:1 program for {client.first_name}
      </p>
      <div>
        <label className="text-xs font-semibold mb-1 block">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="text-xs font-semibold mb-1 block">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-semibold mb-1 block">Billing</label>
          <select
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as "one_time" | "subscription")}
            className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
          >
            <option value="subscription">Monthly</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">
            Price (€){billingType === "subscription" ? "/mo" : ""}
          </label>
          <Input
            type="number"
            min={0}
            value={priceEur}
            onChange={(e) => setPriceEur(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Weeks</label>
          <Input
            type="number"
            min={1}
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(Number(e.target.value))}
          />
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Creating…" : "Create & continue editing"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        You'll add days and exercises in the program editor.
      </p>
    </form>
  );
};

export default AdminClients;
