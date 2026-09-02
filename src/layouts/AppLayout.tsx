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

  // The four places the coach works. Declared once and rendered twice:
  // as a rail on a wide screen, as the bottom bar on a phone.
  const coachNav = [
    { to: "/app/home", icon: <Home size={20} />, label: "Home" },
    { to: "/app/admin/form-checks", icon: <Inbox size={20} />, label: "Inbox" },
    { to: "/app/admin/templates", icon: <Layers size={20} />, label: "Templates" },
    { to: "/app/admin/sessions", icon: <Library size={20} />, label: "Sessions" },
  ];

  return (
    <div
      className={`min-h-screen bg-white flex flex-col ${
        isCoach ? "md:pl-56" : ""
      }`}
    >
      {/* Coach, wide screen only: a fixed rail instead of a strip of
          links under the header.
          The coach's pages are long — an inbox of form checks runs for
          screens — and a horizontal nav scrolls away with them, so
          changing section meant going back to the top first. A rail
          stays put. The client keeps the header and the bottom bar:
          they are on a phone, one screen at a time, and a rail would
          only take width away from the workout.
          Structure borrowed from a mockup Maxime liked; none of its
          look. No XP, no badges, no streaks — this is a work tool. */}
      {isCoach && (
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 border-r border-border bg-white flex-col z-30">
          <Link to="/app/home" className="px-5 py-5">
            <img src={logo} alt="LD Move" className="h-9 w-auto" />
          </Link>

          <nav className="flex-1 px-3 space-y-1">
            {coachNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/app/home"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive
                      ? "bg-accent/10 text-accent font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`
                }
              >
                {n.icon}
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-border p-3 flex items-center gap-2">
            <Link
              to="/app/profile"
              className="flex-1 min-w-0 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <User size={18} className="shrink-0" />
              <span className="truncate">
                {profile?.first_name} {profile?.last_name}
              </span>
            </Link>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
      )}

      {/* Three columns rather than a row: it keeps the mark dead centre
          whatever sits either side of it. The wordmark is gone — the logo
          carries the name already — and so is the rule underneath, which
          was drawing a line across a page that no longer needs one. */}
      <header className={isCoach ? "bg-white md:hidden" : "bg-white"}>
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

      <nav
        className={`fixed bottom-0 left-0 right-0 bg-white border-t border-border ${
          isCoach ? "md:hidden" : "md:static md:border-t-0"
        }`}
      >
        <div className="container flex justify-around md:justify-start md:gap-2 py-2">
          {isCoach &&
            coachNav.map((n) => (
              <BottomLink
                key={n.to}
                to={n.to}
                icon={n.icon}
                label={n.label}
              />
            ))}
          {!isCoach && (
            <BottomLink to="/app/home" icon={<Home size={20} />} label="Home" />
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
