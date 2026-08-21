import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Inside the Android app, land on the coaching space, not on the shop.
 *
 * The native shell loads ldmove.com itself, so without this an app icon
 * on a client's home screen opened the public marketing homepage: hero,
 * pricing, "apply now". That page exists to convert strangers, and the
 * only people with the app installed are clients who already converted.
 *
 * The same build serves both, so the redirect only fires in the native
 * shell and only from the public pages. In a browser ldmove.com stays
 * exactly what it is, and a client who deliberately opens /coaching
 * inside the app is left alone.
 */

/** True when running inside the Capacitor shell rather than a browser.
 *  Capacitor injects this global even when it loads a remote URL. */
function isNativeShell(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform();
}

const NativeAppRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeShell()) return;
    // Only the entry point. Deep links and in-app navigation stay put,
    // otherwise the app would yank the user out of any public page they
    // opened on purpose (legal notice, FAQ) the moment it rendered.
    if (location.pathname !== "/") return;
    navigate("/app", { replace: true });
  }, [location.pathname, navigate]);

  return null;
};

export default NativeAppRedirect;
