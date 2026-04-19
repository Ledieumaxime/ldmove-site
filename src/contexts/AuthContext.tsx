import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Profile = {
  id: string;
  email: string;
  role: "coach" | "client";
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type SessionLike = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
};

type AuthContextValue = {
  session: SessionLike | null;
  user: SessionLike["user"] | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    first_name: string,
    last_name: string
  ) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

const loadStoredSession = (): SessionLike | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionLike;
    if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
};

const saveSession = (s: SessionLike | null) => {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSessionState] = useState<SessionLike | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = (s: SessionLike | null) => {
    setSessionState(s);
    saveSession(s);
  };

  const fetchProfile = async (accessToken: string, userId: string): Promise<Profile | null> => {
    console.log("[AUTH] fetchProfile", userId);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!res.ok) {
        console.error("[AUTH] fetchProfile http error", res.status, await res.text());
        return null;
      }
      const rows = (await res.json()) as Profile[];
      return rows[0] ?? null;
    } catch (e) {
      console.error("[AUTH] fetchProfile exception", e);
      return null;
    }
  };

  useEffect(() => {
    const existing = loadStoredSession();
    if (!existing) {
      setLoading(false);
      return;
    }
    setSessionState(existing);
    fetchProfile(existing.access_token, existing.user.id).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const signUp: AuthContextValue["signUp"] = async (email, password, first_name, last_name) => {
    console.log("[AUTH] signUp start");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, data: { first_name, last_name } }),
      });
      const json = await res.json();
      console.log("[AUTH] signUp status", res.status, json);
      if (!res.ok) return { error: json.msg || json.error_description || "Signup failed" };
      if (json.access_token) {
        const s: SessionLike = {
          access_token: json.access_token,
          refresh_token: json.refresh_token,
          expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
          user: { id: json.user.id, email: json.user.email },
        };
        setSession(s);
        setProfile(await fetchProfile(s.access_token, s.user.id));
      }
      return { error: null };
    } catch (e) {
      console.error("[AUTH] signUp exception", e);
      return { error: String(e) };
    }
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    console.log("[AUTH] signIn start");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      console.log("[AUTH] signIn status", res.status);
      if (!res.ok) return { error: json.msg || json.error_description || "Login failed" };
      const s: SessionLike = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        user: { id: json.user.id, email: json.user.email },
      };
      setSession(s);
      setProfile(await fetchProfile(s.access_token, s.user.id));
      return { error: null };
    } catch (e) {
      console.error("[AUTH] signIn exception", e);
      return { error: String(e) };
    }
  };

  const signOut = async () => {
    if (session) {
      fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => undefined);
    }
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session) setProfile(await fetchProfile(session.access_token, session.user.id));
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
