import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { sbGet } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";
import BackToDashboard from "@/components/BackToDashboard";
import { getPushStatus, onPushStatus, isNativeApp } from "@/lib/push";
import {
  LogOut,
  Mail,
  User as UserIcon,
  Shield,
  ClipboardList,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";

const Profile = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [intakeLocked, setIntakeLocked] = useState(false);

  useEffect(() => {
    if (!user || profile?.role !== "client") return;
    sbGet<{ locked_at: string | null }[]>(
      `client_intakes?client_id=eq.${user.id}&select=locked_at&limit=1`
    )
      .then((rows) => setIntakeLocked(!!rows[0]?.locked_at))
      .catch(() => {});
  }, [user, profile?.role]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/app/login");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <BackToDashboard />
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">Profile</h1>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-white font-heading text-xl">
            {profile?.first_name?.[0] ?? "?"}
          </div>
          <div>
            <p className="font-heading text-xl font-bold">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {profile?.role === "coach" ? "Coach" : "Client"}
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail size={14} />
            <span>{user?.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield size={14} />
            <span>Role: {profile?.role}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserIcon size={14} />
            <span className="font-mono text-xs">ID: {user?.id}</span>
          </div>
        </div>
      </div>

      {profile?.role === "client" && intakeLocked && (
        <Link
          to="/app/intake"
          className="flex items-center justify-between bg-surface border border-border rounded-2xl p-5 hover:border-accent/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center text-sky-700 dark:text-sky-300">
              <ClipboardList size={18} />
            </div>
            <div>
              <p className="font-heading font-bold">View my intake</p>
              <p className="text-xs text-muted-foreground">
                Your answers, coach feedback, and assessment videos.
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </Link>
      )}

      <Appearance />

      <PushStatus isCoach={profile?.role === "coach"} />

      <div>
        <Button variant="outline" className="gap-2" onClick={handleSignOut}>
          <LogOut size={16} />
          Sign out
        </Button>
      </div>
    </div>
  );
};

/** Whether this phone is set up to receive notifications. Only rendered
 *  inside the app: on the website there is nothing to report.
 *
 *  A client gets one plain sentence either way. The underlying reason is
 *  shown to the coach only: it is the sole way to tell a phone that
 *  failed to register from one that simply has nothing to announce, and
 *  it reads like a stack trace, which no client should ever be handed.
 */
const PushStatus = ({ isCoach }: { isCoach: boolean }) => {
  const [status, setStatus] = useState(getPushStatus());

  useEffect(() => onPushStatus(() => setStatus(getPushStatus())), []);

  if (!isNativeApp()) return null;

  const ok = status === "active";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-heading font-bold text-sm">Notifications</p>
      <p
        className={`text-xs mt-1 ${
          ok ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
        }`}
      >
        {ok
          ? "This phone will be notified."
          : "This phone is not set up for notifications yet. Check that they are allowed for LD Move in your phone settings."}
      </p>
      {isCoach && !ok && (
        <p className="text-[11px] mt-2 text-muted-foreground font-mono break-all">
          {status}
        </p>
      )}
    </div>
  );
};

/** Light or dark, as a switch rather than a three-way with a "system"
 *  option: Maxime asked for a button he presses, and a setting that
 *  sometimes changes on its own is not that. The choice is remembered
 *  on this device only.
 *
 *  The row itself is a button, so the whole line is the target rather
 *  than the small track at the end of it. */
const Appearance = () => {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="w-full flex items-center justify-between bg-surface border border-border rounded-2xl p-5 hover:border-accent/60 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          {dark ? <Moon size={18} /> : <Sun size={18} />}
        </div>
        <div>
          <p className="font-heading font-bold">Dark mode</p>
          <p className="text-xs text-muted-foreground">
            {dark ? "On" : "Off"}. Saved on this device.
          </p>
        </div>
      </div>
      <span
        aria-hidden
        className={`w-11 h-6 rounded-full shrink-0 flex items-center px-0.5 transition-colors ${
          dark ? "bg-accent" : "bg-muted"
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full bg-surface shadow-sm transition-transform ${
            dark ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
};


export default Profile;
