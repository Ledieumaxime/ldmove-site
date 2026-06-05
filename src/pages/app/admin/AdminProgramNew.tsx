// Page 1 of the new program creation flow.
//
// Captures the bloc-level metadata and the list of session names. On
// submit we create:
//   - 1 row in `programs` (metadata)
//   - N empty rows in `program_weeks` (one per session, week_number =
//     1..N, title = the session name the coach typed)
// then route to the session editor on the first session.
//
// The previous Build flow was a single text-name field that left the
// coach to add days/sessions one by one inside the editor. The new
// flow asks for the full session structure up-front because in
// practice the coach almost always knows how many sessions and what
// they cover before drafting the prescription.

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { sbGet, sbPost } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Client = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AdminProgramNew = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("client");

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [assignedClientId, setAssignedClientId] = useState<string | null>(
    presetClientId
  );

  // Sessions: each entry is the title the coach gave (e.g. "Push",
  // "Pull", "Legs"). The number of sessions IS the length of this
  // array — there is no separate "number of sessions" field, because
  // changing the count and the names independently was confusing.
  const [sessions, setSessions] = useState<string[]>(["Push", "Pull", "Legs"]);

  const [durationWeeks, setDurationWeeks] = useState<number>(4);

  const [requirePayment, setRequirePayment] = useState(false);
  const [billingType, setBillingType] = useState<"one_time" | "subscription">(
    "one_time"
  );
  const [priceEur, setPriceEur] = useState(49);
  const [subscriptionMonths, setSubscriptionMonths] = useState<number | "">("");

  const [publishNow, setPublishNow] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clients so the coach can pick one (or have it pre-selected
  // when arriving via "Build a new program" from a client page).
  useEffect(() => {
    sbGet<Client[]>(
      "profiles?select=id,email,first_name,last_name&role=eq.client&order=first_name.asc"
    )
      .then(setClients)
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingClients(false));
  }, []);

  // Auto-slug from title unless the coach has hand-edited the slug.
  const handleTitleChange = (next: string) => {
    setTitle(next);
    setSlug((current) => {
      if (!current) return slugify(next);
      // Detect "still auto" by checking if the slug matches the
      // previous title's slug. If yes, regenerate; otherwise leave it.
      if (current === slugify(title)) return slugify(next);
      return current;
    });
  };

  const updateSession = (idx: number, value: string) => {
    setSessions((prev) => prev.map((s, i) => (i === idx ? value : s)));
  };

  const addSession = () => {
    setSessions((prev) => [...prev, `Session ${prev.length + 1}`]);
  };

  const removeSession = (idx: number) => {
    if (sessions.length === 1) return;
    setSessions((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveSession = (idx: number, direction: "up" | "down") => {
    setSessions((prev) => {
      const next = [...prev];
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const isFormReady = useMemo(() => {
    if (!title.trim() || !slug.trim()) return false;
    if (sessions.some((s) => !s.trim())) return false;
    return true;
  }, [title, slug, sessions]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormReady) return;
    setError(null);
    setSaving(true);
    try {
      // 1. Create the program shell.
      const [created] = await sbPost<{ id: string; slug: string }[]>(
        "programs",
        {
          slug,
          title,
          description: description.trim() || null,
          type: assignedClientId ? "custom" : "catalogue",
          assigned_client_id: assignedClientId,
          duration_weeks: durationWeeks,
          price_eur: requirePayment ? priceEur : 0,
          billing_type: requirePayment ? billingType : "one_time",
          subscription_months:
            requirePayment &&
            billingType === "subscription" &&
            subscriptionMonths !== ""
              ? Number(subscriptionMonths)
              : null,
          is_published: publishNow,
          is_archived: false,
        }
      );

      // 2. Create one empty week per session, preserving order.
      const weeks = sessions.map((sessionTitle, idx) => ({
        program_id: created.id,
        week_number: idx + 1,
        title: sessionTitle.trim(),
        notes: null,
      }));
      await sbPost("program_weeks", weeks);

      // 3. Route to the editor on the first session.
      navigate(`/app/admin/programs/${created.id}/edit?session=1`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const clientLabel = (c: Client) =>
    c.first_name || c.last_name
      ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
      : c.email;

  const backHref = presetClientId
    ? `/app/admin/clients/${presetClientId}`
    : "/app/home";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back
      </Link>

      <div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Step 1 of 2
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold mt-1">
          Build a new program
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Set the basics and list the sessions. You'll add exercises on the
          next page.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-6"
      >
        {/* --- Identity --- */}
        <section className="bg-white rounded-2xl border border-border p-5 md:p-6 space-y-5">
          <h2 className="font-heading text-lg font-bold">Program info</h2>

          <div>
            <label className="text-sm font-semibold mb-1 block">Name</label>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              placeholder="e.g. Niki — Bloc 1 (June)"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short summary of the block's focus."
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">
              Assign to client
            </label>
            <select
              value={assignedClientId ?? ""}
              onChange={(e) => setAssignedClientId(e.target.value || null)}
              disabled={loadingClients}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">— Public (catalogue program)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientLabel(c)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to create a public/catalogue program.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">Slug (URL)</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              required
              placeholder="niki-bloc-1-june"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Shown in URL: /app/programs/<b>{slug || "slug"}</b>
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">
              Duration (weeks)
            </label>
            <Input
              type="number"
              min={1}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(Number(e.target.value) || 1)}
              className="max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The number of weeks the client will repeat these sessions.
            </p>
          </div>
        </section>

        {/* --- Sessions --- */}
        <section className="bg-white rounded-2xl border border-border p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-bold">Sessions</h2>
              <p className="text-xs text-muted-foreground">
                Give each session a name (Push, Pull, Legs, Handstand, etc.).
                You'll fill the warmup + workout on the next page.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
              {sessions.length} session{sessions.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2">
            {sessions.map((sessionTitle, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg p-2"
              >
                <span className="text-xs font-bold text-muted-foreground w-6 text-center">
                  {idx + 1}
                </span>
                <Input
                  value={sessionTitle}
                  onChange={(e) => updateSession(idx, e.target.value)}
                  required
                  placeholder="e.g. Push"
                  className="flex-1 h-9"
                />
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveSession(idx, "up")}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-1"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSession(idx, "down")}
                    disabled={idx === sessions.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-1"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(idx)}
                    disabled={sessions.length === 1}
                    className="text-red-600 hover:bg-red-50 p-1 rounded disabled:opacity-30"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSession}
            className="gap-2 w-full"
          >
            <Plus size={14} /> Add a session
          </Button>
        </section>

        {/* --- Payment --- */}
        <section className="bg-white rounded-2xl border border-border p-5 md:p-6 space-y-4">
          <h2 className="font-heading text-lg font-bold">Payment</h2>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requirePayment}
              onChange={(e) => setRequirePayment(e.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">Require payment to unlock</p>
              <p className="text-xs text-muted-foreground">
                If off, the client gets instant access (useful for pre-paid
                block packages).
              </p>
            </div>
          </label>

          {requirePayment && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div>
                <label className="text-sm font-semibold mb-1 block">
                  Billing
                </label>
                <select
                  value={billingType}
                  onChange={(e) =>
                    setBillingType(
                      e.target.value as "one_time" | "subscription"
                    )
                  }
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="one_time">One-time payment</option>
                  <option value="subscription">Monthly subscription</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">
                  Price (€){billingType === "subscription" ? " / month" : ""}
                </label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={priceEur}
                  onChange={(e) => setPriceEur(Number(e.target.value) || 1)}
                  required
                />
              </div>
              {billingType === "subscription" && (
                <div className="col-span-2">
                  <label className="text-sm font-semibold mb-1 block">
                    Subscription length (months, optional)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={subscriptionMonths}
                    onChange={(e) =>
                      setSubscriptionMonths(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="Leave blank = rolling monthly"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* --- Publish --- */}
        <section className="bg-white rounded-2xl border border-border p-5 md:p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">Publish immediately</p>
              <p className="text-xs text-muted-foreground">
                On = the client can see this program right now. Off = saved as
                draft.
              </p>
            </div>
          </label>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="sticky bottom-4 bg-white border border-border rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {sessions.length} session{sessions.length > 1 ? "s" : ""} ·{" "}
            {durationWeeks} week{durationWeeks > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Link to={backHref}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving || !isFormReady}>
              {saving ? "Creating…" : "Next: add exercises"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminProgramNew;
