import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppIntro from "@/components/AppIntro";

/** How long the intro is held at minimum, once per app open.
 *
 *  Maxime asked for this on purpose, knowing it is time nobody strictly
 *  has to wait: opening the app already takes one to two seconds in the
 *  native shell, and a panel that flashes for 300ms on a fast start
 *  reads as a glitch rather than an opening. Held to a beat, it reads as
 *  the product introducing itself.
 */
const INTRO_MS = 2000;

/** Plays once per app open, not per navigation. Module scope survives
 *  every route change and resets on a real reload, which is exactly
 *  "the app was opened again". */
let alreadyPlayed = false;

/**
 * Holds the intro panel over the app's first paint.
 *
 * Wraps the signed-in area only. The public site must never sit behind
 * an app intro, and it does not go through here.
 */
const BootGate = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();
  const [holding, setHolding] = useState(!alreadyPlayed);

  useEffect(() => {
    if (!holding) return;
    const t = setTimeout(() => {
      alreadyPlayed = true;
      setHolding(false);
    }, INTRO_MS);
    return () => clearTimeout(t);
  }, [holding]);

  // Whichever takes longer: the minimum beat, or the session actually
  // coming back from the auth server.
  if (loading || holding) return <AppIntro fullScreen />;
  return <>{children}</>;
};

export default BootGate;
