import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Dumbbell, User, LogOut, Film, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-ldmove.png";

const AppLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isCoach = profile?.role === "coach";

  const handleSignOut = async () => {
    await signOut();
    navigate("/app/login");
  };

  return (
    <div className="min-h-screen bg-sand flex flex-col">
      <header className="bg-white border-b border-border">
        <div className="container flex items-center justify-between py-3">
          <Link to="/app/home" className="flex items-center gap-2">
            <img src={logo} alt="LD Move" className="h-9 w-auto" />
            <span className="font-heading text-lg font-bold">LD Move</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/app/profile"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <User size={18} />
              <span className="hidden md:inline">
                {profile?.first_name} {profile?.last_name}
              </span>
              {isCoach && (
                <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">
                  Coach
                </span>
              )}
            </Link>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6 pb-24 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border md:static md:border-t-0">
        <div className="container flex justify-around md:justify-start md:gap-2 py-2">
          <BottomLink to="/app/home" icon={<Home size={20} />} label="Home" />
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
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-1 rounded-md text-xs md:text-sm ${
        isActive
          ? "text-accent font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default AppLayout;
