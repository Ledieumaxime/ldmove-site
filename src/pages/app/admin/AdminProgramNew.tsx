import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { sbPost } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type NewProgram = {
  slug: string;
  title: string;
  description: string;
  type: "catalogue" | "custom";
  price_eur: number;
  billing_type: "one_time" | "subscription";
  subscription_months: number | null;
  duration_weeks: number | null;
  is_published: boolean;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AdminProgramNew = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewProgram>({
    slug: "",
    title: "",
    description: "",
    type: "catalogue",
    price_eur: 39,
    billing_type: "one_time",
    subscription_months: null,
    duration_weeks: 8,
    is_published: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: f.slug ? f.slug : slugify(title),
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await sbPost<{ id: string }[]>("programs", form);
      navigate(`/app/admin/programs/${created[0].id}/edit`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back
      </Link>

      <h1 className="font-heading text-3xl md:text-4xl font-bold">New program</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-border p-6 space-y-5">
        <div>
          <label className="text-sm font-semibold mb-1 block">Title</label>
          <Input
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            placeholder="e.g. Advanced Middle Split"
          />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block">Slug (URL)</label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            required
            placeholder="advanced-middle-split"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shown in URL: /app/programs/<b>{form.slug || "slug"}</b>
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder="Who is this program for and what does it include."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "catalogue" | "custom" })}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="catalogue">Catalogue (public)</option>
              <option value="custom">1:1 (assigned to a client)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Duration (weeks)</label>
            <Input
              type="number"
              min={1}
              value={form.duration_weeks ?? ""}
              onChange={(e) =>
                setForm({ ...form, duration_weeks: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg p-3">
          <input
            type="checkbox"
            id="paywall"
            checked={form.price_eur > 0}
            onChange={(e) =>
              setForm({ ...form, price_eur: e.target.checked ? form.price_eur || 49 : 0 })
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

        {form.price_eur > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Billing</label>
              <select
                value={form.billing_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    billing_type: e.target.value as "one_time" | "subscription",
                  })
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="one_time">One-time payment</option>
                <option value="subscription">Monthly subscription</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">
                Price (€){form.billing_type === "subscription" ? " / month" : ""}
              </label>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.price_eur}
                onChange={(e) => setForm({ ...form, price_eur: Number(e.target.value) })}
                required
              />
            </div>
          </div>
        )}

        {form.billing_type === "subscription" && (
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Subscription length (months, optional)
            </label>
            <Input
              type="number"
              min={1}
              value={form.subscription_months ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  subscription_months: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Leave blank = rolling monthly"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={form.is_published}
            onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
          />
          <label htmlFor="published" className="text-sm">
            Publish now (otherwise saved as draft)
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create & continue"}
          </Button>
          <Link to="/app/home">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
};

export default AdminProgramNew;
