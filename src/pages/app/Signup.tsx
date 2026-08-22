import { useState, FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo-ldmove.png";

const Signup = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signUp(
      email.trim(),
      password,
      firstName.trim(),
      lastName.trim()
    );
    setLoading(false);
    if (err) return setError(err);
    setSuccess(true);
    setTimeout(() => navigate("/app/home"), 1200);
  };

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* A way out at the top. The "Already a member?" link at the
            bottom of the form was the only one, and someone who landed
            here by mistake should not have to read past every field to
            find it. */}
        <Link
          to="/app/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="LD Move" className="h-16 w-auto mb-2" />
          <h1 className="font-heading text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join LD Move</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">First name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Last name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
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
              minLength={6}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Account created. Redirecting…
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create my account"}
          </Button>
        </form>

      </div>
    </div>
  );
};

export default Signup;
