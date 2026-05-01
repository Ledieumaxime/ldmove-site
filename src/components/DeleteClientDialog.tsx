import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteClient } from "@/integrations/supabase/notify";

/**
 * Hard-delete confirmation dialog. Forces the coach to retype the
 * client's first name before the delete button arms — prevents
 * one-click accidents on an irreversible action. On success the
 * parent receives the result so it can navigate the coach away from
 * the now-deleted client page.
 */

type Props = {
  open: boolean;
  clientId: string;
  clientFirstName: string | null;
  clientEmail: string;
  onClose: () => void;
  onDeleted: () => void;
};

const DeleteClientDialog = ({
  open,
  clientId,
  clientFirstName,
  clientEmail,
  onClose,
  onDeleted,
}: Props) => {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmation("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Close on Escape (unless we're actively deleting — don't strand
  // the operation half-done).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const expected = (clientFirstName ?? "").trim();
  const confirmInput = confirmation.trim();
  // If the client doesn't have a first name on file we fall back to
  // their email — better than letting the delete arm with no guard.
  const expectedToken = expected || clientEmail;
  const armed = confirmInput.length > 0 && confirmInput === expectedToken;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    const res = await deleteClient(clientId);
    if (!res.ok) {
      setError(res.error || "Delete failed");
      setBusy(false);
      return;
    }
    onDeleted();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-white rounded-2xl border border-border w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-client-title"
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-700" />
            </div>
            <div>
              <h2
                id="delete-client-title"
                className="font-heading text-xl font-bold"
              >
                Delete client permanently
              </h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                This is irreversible. Everything tied to this client will be
                wiped.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => !busy && onClose()}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 space-y-1">
            <p className="font-semibold">What gets deleted:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>The client account (email, password, profile)</li>
              <li>All their custom blocks (programs, weeks, exercises)</li>
              <li>All their workout logs and form check submissions</li>
              <li>All form check videos and assessment videos in storage</li>
              <li>Their intake form answers and skill validations</li>
              <li>Every comment they wrote</li>
            </ul>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1 block">
              Type <span className="text-red-700">{expectedToken}</span> to
              confirm
            </label>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={expectedToken}
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!armed || busy}
              className="gap-1.5"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Deleting…
                </>
              ) : (
                "Delete forever"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteClientDialog;
