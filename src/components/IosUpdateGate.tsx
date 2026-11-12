import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sbPost } from "@/integrations/supabase/api";
import {
  IOS_APP_BUILD,
  IOS_APP_VERSION,
  isIosApp,
  isOlderThan,
} from "@/lib/appVersion";
import logo from "@/assets/logo-ldmove.png";

const APP_STORE_URL = "https://apps.apple.com/app/ld-move/id6823914074";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * iPhone app only, from 1.0.3. Two jobs:
 *
 * - Report which version this phone runs, once per launch, for the
 *   signed-in client (profiles.ios_app_version). Until 1.0.3 the only way
 *   to tell who had updated was guessing from push token dates.
 *
 * - Cover the app with "Update LD Move" when this version is below
 *   app_config.ios_min_version. The screens ship inside the iPhone build,
 *   so a client who never updates keeps an old tracker forever; this is
 *   how a fix can be made mandatory. The minimum is read before sign-in,
 *   with the public key, so an old version is stopped at the door too.
 *
 * Every failure lets the app through: offline, a missing setting or an
 * unreadable version must never lock a client out of their session.
 */
const IosUpdateGate = () => {
  const { user } = useAuth();
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (!isIosApp()) return;
    let cancelled = false;
    fetch(
      `${SUPABASE_URL}/rest/v1/app_config?key=eq.ios_min_version&select=value`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { value: string }[]) => {
        const min = rows?.[0]?.value;
        if (!cancelled && min) setOutdated(isOlderThan(IOS_APP_VERSION, min));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isIosApp() || !user?.id || !IOS_APP_VERSION) return;
    sbPost("rpc/record_app_version", {
      p_version: IOS_APP_BUILD
        ? `${IOS_APP_VERSION} (${IOS_APP_BUILD})`
        : IOS_APP_VERSION,
    }).catch(() => {});
  }, [user?.id]);

  if (!outdated) return null;
  return <UpdateRequiredScreen />;
};

export const UpdateRequiredScreen = () => (
  <div className="fixed inset-0 z-[100] bg-white dark:bg-background flex flex-col items-center justify-center text-center p-safe-4">
    <div className="max-w-xs space-y-6">
      <img
        src={logo}
        alt="LD Move"
        className="h-12 w-auto mx-auto dark:invert dark:opacity-95"
      />
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold">Update LD Move</h1>
        <p className="text-sm text-muted-foreground">
          This version of the app is out of date. Update it from the App
          Store to keep training.
        </p>
      </div>
      <a
        href={APP_STORE_URL}
        className="flex items-center justify-center w-full h-[50px] rounded-full bg-accent text-white text-base font-semibold"
      >
        Update
      </a>
    </div>
  </div>
);

export default IosUpdateGate;
