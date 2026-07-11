import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { sbGet } from "@/integrations/supabase/api";

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
    // IMPORTANT: do NOT drop the session just because the local clock
    // thinks the access token is expired. A device clock that's ahead
    // of real time (a very common phone misconfiguration) would make a
    // perfectly valid token look expired and log the user out
    // mid-session. We always return the stored session and let the
    // refresh loop renew the access token from the refresh_token,
    // which has a much longer life and is validated server-side.
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
  // Read the stored session synchronously on first render so consumers
  // (e.g. the public Navbar) don't flash "Login" before the effect
  // below hydrates state. Expired tokens are filtered out by
  // loadStoredSession and treated as no session.
  const [session, setSessionState] = useState<SessionLike | null>(() =>
    loadStoredSession()
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = (s: SessionLike | null) => {
    setSessionState(s);
    saveSession(s);
  };

  // Goes through the api helper (not a raw fetch) so an expired stored
  // access token gets refreshed and retried. A raw fetch here returned
  // 401 when the app booted with a stale token — since we deliberately
  // stopped dropping stale sessions, that left profile=null forever and
  // silently disabled every profile-gated action (sending comments,
  // most visibly). The token argument is kept for call-site
  // compatibility but the helper reads localStorage itself.
  const fetchProfile = async (_accessToken: string, userId: string): Promise<Profile | null> => {
    console.log("[AUTH] fetchProfile", userId);
    try {
      const rows = await sbGet<Profile[]>(`profiles?id=eq.${userId}&select=*`);
      return rows[0] ?? null;
    } catch (e) {
      console.error("[AUTH] fetchProfile failed", e);
      return null;
    }
  };

  useEffect(() => {
    // 1. If Supabase has redirected us back with a magic-link / invite /
    //    recovery token in the URL hash, turn it into a session before
    //    falling back to any stored one.
    const hashCallback = async (): Promise<boolean> => {
      if (typeof window === "undefined") return false;
      const hash = window.location.hash?.replace(/^#/, "");
      if (!hash || !hash.includes("access_token=")) return false;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const expires_in = parseInt(params.get("expires_in") || "3600", 10);
      if (!access_token || !refresh_token) return false;
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${access_token}`,
          },
        });
        if (!userRes.ok) return false;
        const u = await userRes.json();
        const s: SessionLike = {
          access_token,
          refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + expires_in,
          user: { id: u.id, email: u.email },
        };
        setSession(s);
        // Clean the URL — drop the hash so a browser refresh doesn't
        // try to re-use a single-use token.
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        const p = await fetchProfile(s.access_token, s.user.id);
        setProfile(p);
        return true;
      } catch (e) {
        console.error("[AUTH] hash callback failed", e);
        return false;
      }
    };

    (async () => {
      const recovered = await hashCallback();
      if (recovered) {
        setLoading(false);
        return;
      }
      const existing = loadStoredSession();
      if (!existing) {
        setLoading(false);
        return;
      }
      setSessionState(existing);
      const p = await fetchProfile(existing.access_token, existing.user.id);
      setProfile(p);
      setLoading(false);
    })();
  }, []);

  // ---- Profile recovery -------------------------------------------------
  // If the boot-time profile fetch failed (offline moment, transient
  // 401 the retry couldn't heal), retry whenever the access token
  // changes. Without this, profile stays null for the whole session and
  // every profile-gated action (posting comments, coach tools) silently
  // no-ops even though the user looks logged in.
  useEffect(() => {
    if (!session || profile) return;
    let cancelled = false;
    (async () => {
      const p = await fetchProfile(session.access_token, session.user.id);
      if (!cancelled && p) setProfile(p);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, profile]);

  // ---- Proactive access-token refresh ----------------------------------
  // Supabase access tokens default to 1h. Without this loop the user
  // sees a 'JWT expired' 401 the next time they save a workout log /
  // form check / anything from the client side. We swap the token
  // around T-2min and chain a new timeout each time.
  useEffect(() => {
    if (!session?.refresh_token) return;
    const refreshAt =
      (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000 -
      2 * 60 * 1000; // 2 minutes before expiry
    const delay = Math.max(5_000, refreshAt - Date.now()); // never zero / negative
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          }
        );
        if (!res.ok) {
          // Do NOT sign the user out here. A failed scheduled refresh
          // is most often a transient network blip (training in a gym
          // with weak signal), which used to log Cym out mid-session.
          // Keep the current session; the api-layer refresh+retry and
          // the visibility handler will renew it on the next action.
          console.warn("[AUTH] scheduled refresh failed (keeping session)", res.status);
          return;
        }
        const json = await res.json();
        const next: SessionLike = {
          access_token: json.access_token,
          refresh_token: json.refresh_token ?? session.refresh_token,
          expires_at:
            json.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
          user: session.user,
        };
        setSession(next);
      } catch (e) {
        console.error("[AUTH] refresh token error", e);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session?.access_token]);

  // ---- Refresh on tab focus -------------------------------------------
  // Mobile Safari often kills the setTimeout above when the tab/screen
  // goes inactive. When the coach (or client) re-opens the page after
  // a long pause, jump-start a refresh if the stored token is close to
  // expiry. Stops the JWT-expired errors that appear the moment they
  // try to mark a workout complete.
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      const stored = loadStoredSession();
      if (!stored?.refresh_token) return;
      const msToExpiry = (stored.expires_at ?? 0) * 1000 - Date.now();
      if (msToExpiry > 2 * 60 * 1000) return; // still fresh
      try {
        const res = await fetch(
          `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: stored.refresh_token }),
          }
        );
        // Same policy as the scheduled refresh: never sign out on a
        // failed refresh, just keep the session and let the next API
        // call heal it. Signing out mid-training is the worst outcome.
        if (!res.ok) {
          console.warn("[AUTH] visibility refresh failed (keeping session)", res.status);
          return;
        }
        const json = await res.json();
        setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token ?? stored.refresh_token,
          expires_at:
            json.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
          user: stored.user,
        });
      } catch (e) {
        console.error("[AUTH] visibility refresh failed", e);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
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
