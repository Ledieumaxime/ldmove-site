import { FormEvent, useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Standalone "Invite a client" dialog. Sends a magic-link invite via
 * the invite-client edge function and optionally assigns one of the
 * catalogue / unassigned 1:1 programs at the same time.
 *
 * The component owns its own data fetch (unassigned programs) so it
 * can be dropped anywhere in the admin UI without the parent having
 * to thread program data through props.
 */

type Program = {
  id: string;
  title: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful invite so the parent can refresh its
   *  data (the new client will show up in the dashboard's "Without
   *  active program" list once they accept). */
  onInvited?: () => void;
};

const InviteClientDialog = ({ open, onClose, onInvited }: Props) => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [programId, setProgramId] = useState("");
  const [unassignedPrograms, setUnassignedPrograms] = useState<Program[]>([]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fetch unassigned 1:1 programs once the dialog opens. Anything
  // assigned to a client already is filtered out — we don't want to
  // double-assign by mistake.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const rows = await sbGet<Program[]>(
          "programs?select=id,title&type=eq.custom&assigned_client_id=is.null&order=created_at.desc"
        );
        setUnassignedPrograms(rows);
      } catch {
        setUnassignedPrograms([]);
      }
    })();
  }, [open]);

  // Reset form whenever the dialog closes, so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setEmail("");
      setFirstName("");
      setProgramId("");
      setErr(null);
      setSending(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  if (!open) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setErr(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const raw = localStorage.getItem("ldmove-session");
      const token = raw ? JSON.parse(raw).access_token : null;
      if (!token)
        throw new Error("Your session expired. Please log out and log back in.");

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

      const rawText = await res.text();
      let body: { error?: string } = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        // fall through — surface rawText below
      }
      if (!res.ok || body.error) {
        const detail = body.error || rawText || `status ${res.status}`;
        throw new Error(`Server error ${res.status}: ${detail.slice(0, 300)}`);
      }
      onInvited?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !sending && onClose()}
    >
      <div
        className="bg-white rounded-2xl border border-border w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-dialog-title"
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2
              id="invite-dialog-title"
              className="font-heading text-xl font-bold"
            >
              Invite a new client
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              They'll get an email with a one-click link to their space. No
              password to set.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => !sending && onClose()}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">
                First name *
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alexandro"
                required
                maxLength={100}
                autoFocus
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
                <option value="">None, just invite</option>
                {unassignedPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Only unassigned 1:1 programs are listed. You can always build a
                block for them later from their page.
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
    </div>
  );
};

export default InviteClientDialog;
