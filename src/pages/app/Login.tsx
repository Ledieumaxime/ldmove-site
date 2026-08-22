import { useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo-ldmove.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  // Set by the api layer when it had to drop an unrecoverable session
  // (refresh token definitively rejected by the auth server).
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: err } = await signIn(email.trim(), password);
      setLoading(false);
      if (err) setError(err);
      else navigate("/app/home");
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    const target = email.trim();
    if (!target) {
      setError("Enter your email first, then click 'Forgot password?'.");
      return;
    }
    setError(null);
    setInfo(null);
    setForgotLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(
          "https://www.ldmove.com/app/reset-password"
        )}`,
        {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email: target }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.msg || json.error_description || "Could not send reset email");
      } else {
        setInfo(
          `If an account exists for ${target}, we've sent a password reset link. Check your inbox.`
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    // Full-bleed white rather than a card floating on sand: this is the
    // app's first screen, and in the native shell it is the first thing
    // anyone sees of LD Move. It should read as the product opening, not
    // as a form dropped on a page.
    <div className="min-h-screen bg-white flex flex-col px-6 py-12 md:items-center md:justify-center">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1">
        <img src={logo} alt="LD Move" className="h-28 w-28 -ml-2 mb-8" />

        <h1 className="font-heading text-[2.5rem] leading-[1.1] font-bold tracking-tight">
          Move with
          <br />
          your coach.
        </h1>
        <p className="text-muted-foreground mt-3 mb-8 leading-relaxed">
          Your program, your sessions and your form checks, in one place.
        </p>

        {sessionExpired && !error && !info && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            Your session expired after a long time away. Sign in again to
            pick up where you left off.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          {/* Labels carry the field for screen readers; the placeholder
              carries it visually, as in the mockup. */}
          <label className="sr-only" htmlFor="login-email">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-14 rounded-xl border-0 bg-muted px-4 text-base placeholder:text-muted-foreground"
          />
          <label className="sr-only" htmlFor="login-password">
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-14 rounded-xl border-0 bg-muted px-4 text-base placeholder:text-muted-foreground"
          />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              {info}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-14 rounded-xl text-base font-semibold bg-accent hover:bg-accent/90 text-white"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <Link
          to="/app/signup"
          className="flex items-center justify-center w-full h-14 rounded-xl border border-border text-base font-semibold mt-3 hover:bg-muted transition"
        >
          Create account
        </Link>

        <div className="text-center mt-5">
          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={forgotLoading}
            className="text-sm text-muted-foreground hover:text-accent hover:underline"
          >
            {forgotLoading ? "Sending…" : "Forgot your password?"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;
