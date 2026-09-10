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

/** Long enough to read as a fade, short enough not to feel like more
 *  waiting on top of the wait. */
const FADE_MS = 450;

/** Plays once per app open, not per navigation. Module scope survives
 *  every route change and resets on a real reload, which is exactly
 *  "the app was opened again". */
let alreadyPlayed = false;

/**
 * Holds the intro panel over the app's first paint, then fades it out.
 *
 * The fade is the whole point of the three phases. Swapping the panel
 * for the page in one render was a hard cut between a dark screen and a
 * white one, which reads as two unrelated screens rather than one
 * opening. So the page mounts underneath first, and the panel stays on
 * top for the length of the fade before it goes.
 *
 * Wraps the signed-in area only. The public site must never sit behind
 * an app intro, and it does not go through here.
 */
const BootGate = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();
  const [phase, setPhase] = useState<"intro" | "fading" | "done">(
    alreadyPlayed ? "done" : "intro"
  );
  const [held, setHeld] = useState(!alreadyPlayed);
  // Drives the opacity: the overlay mounts opaque and is flipped on the
  // next frame, because a CSS transition needs two distinct values to
  // animate between.
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), INTRO_MS);
    return () => clearTimeout(t);
  }, [held]);

  // Whichever takes longer: the minimum beat, or the session actually
  // coming back from the auth server.
  useEffect(() => {
    if (phase !== "intro" || loading || held) return;
    setPhase("fading");
  }, [phase, loading, held]);

  useEffect(() => {
    if (phase !== "fading") return;
    const raf = requestAnimationFrame(() => setFaded(true));
    const t = setTimeout(() => {
      alreadyPlayed = true;
      setPhase("done");
    }, FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [phase]);

  if (phase === "intro") return <AppIntro fullScreen />;

  return (
    <>
      {children}
      {phase === "fading" && (
        <div
          aria-hidden
          className="fixed inset-0 z-50 pointer-events-none transition-opacity duration-[450ms] ease-out"
          style={{ opacity: faded ? 0 : 1 }}
        >
          <AppIntro fullScreen />
        </div>
      )}
    </>
  );
};

export default BootGate;
