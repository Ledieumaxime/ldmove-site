import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, UserPlus, Dumbbell, Calendar, Send, X, ClipboardList, ClipboardCheck } from "lucide-react";
import { sbGet, sbPost } from "@/integrations/supabase/api";
import { notifyProgramPublished } from "@/integrations/supabase/notify";
import { supabase } from "@/integrations/supabase/client";
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
  const [intakeClientIds, setIntakeClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p, intakes] = await Promise.all([
        sbGet<Client[]>("profiles?select=*&role=eq.client&order=created_at.desc"),
        sbGet<Program[]>("programs?select=*&order=created_at.desc"),
        sbGet<Array<{ client_id: string }>>("client_intakes?select=client_id"),
      ]);
      setClients(c);
      setPrograms(p);
      setIntakeClientIds(new Set(intakes.map((r) => r.client_id)));
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">Admin · Clients</h1>
          <p className="text-muted-foreground text-sm">
            All registered client accounts. Invite a new one or assign a 1:1 program.
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          className="gap-2"
          onClick={() => setInviteOpen(true)}
        >
          <Send size={14} /> Invite a client
        </Button>
      </div>

      {inviteOpen && (
        <InviteForm
          unassignedPrograms={programs.filter(
            (p) => p.type === "custom" && p.assigned_client_id === null
          )}
          onClose={() => setInviteOpen(false)}
          onDone={() => {
            setInviteOpen(false);
            load();
          }}
        />
      )}

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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      asChild
                    >
                      <Link to={`/app/admin/clients/${c.id}/intake`}>
                        {intakeClientIds.has(c.id) ? (
                          <>
                            <ClipboardCheck size={14} className="text-green-600" />
                            View intake
                          </>
                        ) : (
                          <>
                            <ClipboardList size={14} className="text-muted-foreground" />
                            No intake yet
                          </>
                        )}
                      </Link>
                    </Button>
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

const InviteForm = ({
  unassignedPrograms,
  onClose,
  onDone,
}: {
  unassignedPrograms: Program[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [programId, setProgramId] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setErr(null);
    try {
      // Call the edge function directly so we can surface the real error body
      // from the server instead of the generic supabase-js "non-2xx" message.
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const raw = localStorage.getItem("ldmove-session");
      const token = raw ? JSON.parse(raw).access_token : null;
      if (!token) throw new Error("Your session expired. Please log out and log back in.");

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/invite-client`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            first_name: firstName.trim(),
            program_id: programId || null,
          }),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        throw new Error(body.error || `Server error (${res.status})`);
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-bold">Invite a new client</h2>
          <p className="text-muted-foreground text-sm">
            They'll receive an email with a one-click link to their space. No password to set.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block">First name *</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Alexandro"
              required
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">Email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              required
              maxLength={255}
            />
          </div>
        </div>

        {unassignedPrograms.length > 0 && (
          <div>
            <label className="text-xs font-semibold mb-1 block">
              Assign a program (optional)
            </label>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— None, just invite —</option>
              {unassignedPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Only unassigned 1:1 programs are listed. You can always assign one later.
            </p>
          </div>
        )}

        {err && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
            {err}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={sending} className="gap-1.5">
            <Send size={14} />
            {sending ? "Sending…" : "Send invite"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminClients;
