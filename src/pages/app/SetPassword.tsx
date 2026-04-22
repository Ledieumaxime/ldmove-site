import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo-ldmove.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type Mode = "welcome" | "reset";

const COPY: Record<Mode, {
  tag: string;
  title: string;
  intro: string;
  button: string;
}> = {
  welcome: {
    tag: "Welcome",
    title: "Create your password",
    intro:
      "Pick a password you'll use to sign in from now on. You only need to do this once.",
    button: "Create password and continue",
  },
  reset: {
    tag: "Reset",
    title: "Set a new password",
    intro: "Choose a new password for your account.",
    button: "Save new password",
  },
};

const SetPassword = ({ mode }: { mode: Mode }) => {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const copy = COPY[mode];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    if (!session) {
      setError("Your session is invalid. Please use the link from your email again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          data: { password_set: true },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.msg || json.error_description || "Could not update password");
      }
      await refreshProfile();
      setDone(true);
      // Give the user a second to see the success then route them to their space
      setTimeout(() => navigate("/app/home"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-3">
          <img src={logo} alt="LD Move" className="h-16 w-auto mb-2 mx-auto" />
          <h1 className="font-heading text-xl font-bold">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This link has expired or been used already. Please go back to your
            email and click the most recent one, or request a new password
            reset from the login page.
          </p>
          <Button onClick={() => navigate("/app/login")} className="mt-2">
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="text-green-600" size={28} />
          </div>
          <h1 className="font-heading text-xl font-bold">All set</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been saved. Taking you to your space…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="LD Move" className="h-16 w-auto mb-2" />
          <p className="text-xs font-semibold text-accent uppercase tracking-widest">
            {copy.tag}
          </p>
          <h1 className="font-heading text-2xl font-bold mt-1">{copy.title}</h1>
          <p className="text-sm text-muted-foreground text-center mt-2">
            {copy.intro}
          </p>
          {session?.user?.email && (
            <p className="text-xs text-muted-foreground mt-2">
              Account: <span className="font-semibold">{session.user.email}</span>
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">New password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Confirm password</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Saving…" : copy.button}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SetPassword;
