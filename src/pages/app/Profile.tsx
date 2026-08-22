import { useEffect, useState } from "react";
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

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
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
          className="flex items-center justify-between bg-white border border-border rounded-2xl p-5 hover:border-accent/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700">
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
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="font-heading font-bold text-sm">Notifications</p>
      <p
        className={`text-xs mt-1 ${
          ok ? "text-emerald-700" : "text-muted-foreground"
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

export default Profile;
