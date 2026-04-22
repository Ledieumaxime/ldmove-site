import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo-ldmove.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

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

  const sendMagicLink = async () => {
    const target = email.trim();
    if (!target) {
      setError("Enter your email first.");
      return;
    }
    setError(null);
    setInfo(null);
    setMagicLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: target,
          create_user: false,
          options: { email_redirect_to: "https://www.ldmove.com/app/home" },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.msg || json.error_description || "Could not send magic link");
      } else {
        setInfo(
          `Check your inbox — we just sent a login link to ${target}. Click it to sign in.`
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="LD Move" className="h-16 w-auto mb-2" />
          <h1 className="font-heading text-2xl font-bold">Welcome</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your space
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {info}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground tracking-wider">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={sendMagicLink}
          disabled={magicLoading}
        >
          {magicLoading ? "Sending…" : "Email me a login link"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground mt-1.5">
          No password needed — we'll send a one-click link to sign you in.
        </p>

        <p className="text-center text-sm text-muted-foreground mt-6">
          No account yet?{" "}
          <Link to="/app/signup" className="text-accent font-semibold hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          <Link to="/" className="hover:underline">
            ← Back to site
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
