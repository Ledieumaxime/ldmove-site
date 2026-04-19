import { useEffect, useState, FormEvent } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Eye, Mail } from "lucide-react";
import { sbGet, sbPatch, sbPost, sbDelete } from "@/integrations/supabase/api";
import { notifyProgramPublished, cleanupArchivedVideos } from "@/integrations/supabase/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import WeekExerciseEditor from "@/components/WeekExerciseEditor";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "catalogue" | "custom";
  price_eur: number;
  billing_type: "one_time" | "subscription";
  subscription_months: number | null;
  duration_weeks: number | null;
  is_published: boolean;
  is_archived: boolean;
  assigned_client_id: string | null;
};

type Week = {
  id: string;
  program_id: string;
  week_number: number;
  title: string | null;
  notes: string | null;
};

type Client = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

const AdminProgramEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<{ is_archived: boolean; is_published: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, w, c] = await Promise.all([
        sbGet<Program[]>(`programs?select=*&id=eq.${id}&limit=1`),
        sbGet<Week[]>(`program_weeks?select=*&program_id=eq.${id}&order=week_number.asc`),
        sbGet<Client[]>(
          "profiles?select=id,email,first_name,last_name&role=eq.client&order=first_name.asc"
        ),
      ]);
      if (p.length === 0) {
        setError("Program not found.");
        return;
      }
      setProgram(p[0]);
      setInitialState({ is_archived: p[0].is_archived, is_published: p[0].is_published });
      setWeeks(w);
      setClients(c);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const saveProgram = async (e: FormEvent) => {
    e.preventDefault();
    if (!program) return;
    setSaving(true);
    setError(null);
    try {
      await sbPatch(`programs?id=eq.${program.id}`, {
        slug: program.slug,
        title: program.title,
        description: program.description,
        type: program.type,
        price_eur: program.price_eur,
        billing_type: program.billing_type,
        subscription_months: program.subscription_months,
        duration_weeks: program.duration_weeks,
        is_published: program.is_published,
        is_archived: program.is_archived,
        assigned_client_id: program.assigned_client_id,
      });
      setFlash("Program saved ✅");
      setTimeout(() => setFlash(null), 2000);

      // Auto-notify client if we just activated a 1:1 program
      const wasHidden = initialState && (initialState.is_archived || !initialState.is_published);
      const isNowActive = program.is_published && !program.is_archived;
      if (
        program.type === "custom" &&
        program.assigned_client_id &&
        wasHidden &&
        isNowActive
      ) {
        const shouldSend = confirm(
          "Program is now active for this client. Send the 'new program' email notification?"
        );
        if (shouldSend) {
          setNotifying(true);
          const r = await notifyProgramPublished(program.id);
          setNotifying(false);
          setFlash(r.ok ? "Client notified ✅" : `Email error: ${r.error}`);
          setTimeout(() => setFlash(null), 3000);
        }
      }

      // Auto-cleanup form check videos when archiving
      const wasActive = initialState && !initialState.is_archived;
      const isNowArchived = program.is_archived;
      if (wasActive && isNowArchived) {
        const r = await cleanupArchivedVideos(program.id);
        if (r.ok && r.deleted && r.deleted > 0) {
          setFlash(`Archived ✅ · ${r.deleted} form check video${r.deleted > 1 ? "s" : ""} deleted`);
          setTimeout(() => setFlash(null), 3000);
        }
      }

      setInitialState({ is_archived: program.is_archived, is_published: program.is_published });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const notifyNow = async () => {
    if (!program) return;
    if (!program.assigned_client_id) {
      alert("This program has no assigned client.");
      return;
    }
    if (!confirm("Send the 'new program' email to the assigned client?")) return;
    setNotifying(true);
    const r = await notifyProgramPublished(program.id);
    setNotifying(false);
    setFlash(r.ok ? "Client notified ✅" : `Email error: ${r.error}`);
    setTimeout(() => setFlash(null), 3000);
  };

  const addWeek = async () => {
    if (!program) return;
    const nextNum = weeks.length === 0 ? 1 : Math.max(...weeks.map((w) => w.week_number)) + 1;
    try {
      const created = await sbPost<Week[]>("program_weeks", {
        program_id: program.id,
        week_number: nextNum,
        title: `Day ${nextNum}`,
      });
      setWeeks([...weeks, ...created]);
    } catch (err) {
      setError(String(err));
    }
  };

  const updateWeek = (wid: string, field: "title" | "notes", value: string) => {
    setWeeks((ws) => ws.map((w) => (w.id === wid ? { ...w, [field]: value } : w)));
  };

  const saveWeek = async (w: Week) => {
    try {
      await sbPatch(`program_weeks?id=eq.${w.id}`, {
        title: w.title,
        notes: w.notes,
      });
      setFlash("Day saved ✅");
      setTimeout(() => setFlash(null), 1500);
    } catch (err) {
      setError(String(err));
    }
  };

  const deleteWeek = async (wid: string) => {
    if (!confirm("Delete this day?")) return;
    try {
      await sbDelete(`program_weeks?id=eq.${wid}`);
      setWeeks((ws) => ws.filter((w) => w.id !== wid));
    } catch (err) {
      setError(String(err));
    }
  };

  const deleteProgram = async () => {
    if (!program) return;
    if (!confirm(`Permanently delete "${program.title}"?`)) return;
    try {
      await sbDelete(`programs?id=eq.${program.id}`);
      navigate("/app/admin/programs");
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error && !program)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!program) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/app/admin/programs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <Link
          to={`/app/programs/${program.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Eye size={14} /> View as client
        </Link>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl font-bold">{program.title}</h1>

      {flash && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {flash}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Program info */}
      <form onSubmit={saveProgram} className="bg-white rounded-2xl border border-border p-6 space-y-5">
        <h2 className="font-heading text-xl font-bold">Info</h2>

        <div>
          <label className="text-sm font-semibold mb-1 block">Title</label>
          <Input value={program.title} onChange={(e) => setProgram({ ...program, title: e.target.value })} required />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block">Slug (URL)</label>
          <Input value={program.slug} onChange={(e) => setProgram({ ...program, slug: e.target.value })} required />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block">Description</label>
          <Textarea
            value={program.description ?? ""}
            onChange={(e) => setProgram({ ...program, description: e.target.value })}
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Type</label>
            <select
              value={program.type}
              onChange={(e) => setProgram({ ...program, type: e.target.value as "catalogue" | "custom" })}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="catalogue">Catalogue</option>
              <option value="custom">1:1</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Duration (weeks)</label>
            <Input
              type="number"
              min={1}
              value={program.duration_weeks ?? ""}
              onChange={(e) =>
                setProgram({
                  ...program,
                  duration_weeks: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </div>

        {program.type === "custom" && (
          <div>
            <label className="text-sm font-semibold mb-1 block">Assigned client</label>
            <select
              value={program.assigned_client_id ?? ""}
              onChange={(e) =>
                setProgram({
                  ...program,
                  assigned_client_id: e.target.value || null,
                })
              }
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">— No client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg p-3">
          <input
            type="checkbox"
            id="paywall"
            checked={Number(program.price_eur) > 0}
            onChange={(e) =>
              setProgram({ ...program, price_eur: e.target.checked ? (program.price_eur || 49) : 0 })
            }
          />
          <label htmlFor="paywall" className="text-sm flex-1">
            <b>Require payment to unlock</b>
            <br />
            <span className="text-xs text-muted-foreground">
              If off, the client gets instant access (useful for pre-paid block packages).
            </span>
          </label>
        </div>

        {Number(program.price_eur) > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Billing</label>
              <select
                value={program.billing_type}
                onChange={(e) =>
                  setProgram({ ...program, billing_type: e.target.value as "one_time" | "subscription" })
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="one_time">One-time payment</option>
                <option value="subscription">Monthly subscription</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">
                Price (€){program.billing_type === "subscription" ? " / month" : ""}
              </label>
              <Input
                type="number"
                min={1}
                value={program.price_eur}
                onChange={(e) => setProgram({ ...program, price_eur: Number(e.target.value) })}
                required
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pub"
            checked={program.is_published}
            onChange={(e) => setProgram({ ...program, is_published: e.target.checked })}
          />
          <label htmlFor="pub" className="text-sm">
            Published (visible to clients)
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="arch"
            checked={program.is_archived}
            onChange={(e) => setProgram({ ...program, is_archived: e.target.checked })}
          />
          <label htmlFor="arch" className="text-sm">
            Archived (free access in the client's "Archived" section)
          </label>
        </div>

        <div className="flex gap-3 pt-2 flex-wrap">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save size={16} /> {saving ? "Saving…" : "Save"}
          </Button>
          {program.type === "custom" && program.assigned_client_id && (
            <Button
              type="button"
              variant="outline"
              onClick={notifyNow}
              disabled={notifying}
              className="gap-2"
            >
              <Mail size={16} /> {notifying ? "Sending…" : "Notify client"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={deleteProgram} className="gap-2 text-red-600 hover:bg-red-50">
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      </form>

      {/* Days */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold">Days</h2>
          <Button variant="outline" onClick={addWeek} className="gap-2">
            <Plus size={16} /> Add a day
          </Button>
        </div>

        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No days yet. Click "Add a day" to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {weeks.map((w) => (
              <div key={w.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Day {w.week_number}</span>
                  <button
                    onClick={() => deleteWeek(w.id)}
                    className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
                <Input
                  value={w.title ?? ""}
                  onChange={(e) => updateWeek(w.id, "title", e.target.value)}
                  placeholder="Day title"
                />
                <Textarea
                  value={w.notes ?? ""}
                  onChange={(e) => updateWeek(w.id, "notes", e.target.value)}
                  placeholder="Notes / goals for the day"
                  rows={2}
                />
                <div>
                  <Button size="sm" variant="outline" onClick={() => saveWeek(w)}>
                    Save this day
                  </Button>
                </div>

                <WeekExerciseEditor weekId={w.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProgramEdit;
