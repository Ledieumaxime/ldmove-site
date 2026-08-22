import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  Dumbbell,
  User,
  LogOut,
  Film,
  History,
  Inbox,
  Layers,
  Library,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { sbGet } from "@/integrations/supabase/api";
import { registerForPush, PUSH_OPENED_EVENT } from "@/lib/push";
import RouteFallback from "@/components/RouteFallback";
import logo from "@/assets/logo-ldmove.png";

/** Fired by the archive page once it has marked the milestones as seen,
 *  so the badge clears without waiting for a navigation. */
export const MILESTONES_SEEN_EVENT = "ldmove:milestones-seen";

const AppLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCoach = profile?.role === "coach";

  // Unread "a milestone was archived for you" notifications. They are the
  // count of videos the coach added since the client last opened their
  // archive, which is exactly what the badge promises.
  const [newVideos, setNewVideos] = useState(0);

  const refreshBadge = useCallback(async () => {
    if (!profile || isCoach) return;
    try {
      const rows = await sbGet<{ id: string }[]>(
        `notifications?user_id=eq.${profile.id}&read=eq.false&type=eq.progress_archived&select=id`
      );
      setNewVideos(rows.length);
    } catch {
      // A failed count must never block the shell from rendering.
    }
  }, [profile, isCoach]);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge, location.pathname]);

  useEffect(() => {
    const clear = () => setNewVideos(0);
    window.addEventListener(MILESTONES_SEEN_EVENT, clear);
    return () => window.removeEventListener(MILESTONES_SEEN_EVENT, clear);
  }, []);

  // Claim this device for the signed-in user. No-op in a browser, and
  // no-op until we know who is signed in: a token saved against nobody
  // would ring for nobody.
  useEffect(() => {
    if (!profile?.id) return;
    void registerForPush(profile.id);
  }, [profile?.id]);

  // Tapping a push opens the page it was about.
  useEffect(() => {
    const open = (e: Event) => {
      const link = (e as CustomEvent<{ link: string }>).detail?.link;
      if (link) navigate(link);
    };
    window.addEventListener(PUSH_OPENED_EVENT, open);
    return () => window.removeEventListener(PUSH_OPENED_EVENT, open);
  }, [navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/app/login");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Three columns rather than a row: it keeps the mark dead centre
          whatever sits either side of it. The wordmark is gone — the logo
          carries the name already — and so is the rule underneath, which
          was drawing a line across a page that no longer needs one. */}
      <header className="bg-white">
        <div className="container grid grid-cols-3 items-center py-3">
          <Link
            to="/app/profile"
            className="justify-self-start flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <User size={20} />
            <span className="hidden md:inline">
              {profile?.first_name} {profile?.last_name}
            </span>
            {isCoach && (
              <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">
                Coach
              </span>
            )}
          </Link>
          <Link to="/app/home" className="justify-self-center">
            <img src={logo} alt="LD Move" className="h-10 w-auto" />
          </Link>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="justify-self-end text-muted-foreground hover:text-foreground"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 container py-6 pb-24 md:pb-10">
        {/* Inner boundary: while a lazy page chunk downloads, the app
            shell (header + bottom nav) stays in place instead of the
            whole screen being replaced by the top-level fallback. */}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border md:static md:border-t-0">
        <div className="container flex justify-around md:justify-start md:gap-2 py-2">
          <BottomLink to="/app/home" icon={<Home size={20} />} label="Home" />
          {isCoach && (
            <>
              <BottomLink
                to="/app/admin/form-checks"
                icon={<Inbox size={20} />}
                label="Inbox"
              />
              <BottomLink
                to="/app/admin/templates"
                icon={<Layers size={20} />}
                label="Templates"
              />
              <BottomLink
                to="/app/admin/sessions"
                icon={<Library size={20} />}
                label="Sessions"
              />
            </>
          )}
          {!isCoach && (
            <>
              <BottomLink
                to="/app/programs"
                icon={<Dumbbell size={20} />}
                label="Programs"
              />
              <BottomLink
                to="/app/history"
                icon={<History size={20} />}
                label="History"
              />
              <BottomLink
                to="/app/archive"
                icon={<Film size={20} />}
                label="My videos"
                badge={newVideos}
              />
            </>
          )}
        </div>
      </nav>
    </div>
  );
};

const BottomLink = ({
  to,
  icon,
  label,
  badge = 0,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  /** Unread count. Zero renders nothing, so the dot only ever means
   *  "there is something new in here". */
  badge?: number;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `relative flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-1 rounded-md text-xs md:text-sm ${
        isActive
          ? "text-accent font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`
    }
  >
    <span className="relative">
      {icon}
      {badge > 0 && (
        <span
          aria-label={`${badge} new`}
          className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-4 text-center"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </span>
    <span>{label}</span>
  </NavLink>
);

export default AppLayout;
