/**
 * Register this device to receive push notifications.
 *
 * Runs only inside the native shell. In a browser every call is a no-op:
 * the same build serves ldmove.com, and asking a website visitor for
 * notification permission would be both useless and rude.
 *
 * Firebase issues a token per install. We store it against the signed-in
 * user so the sender knows which phone to ring. Tokens rotate on their
 * own (reinstall, cleared data, Firebase refresh), which is why the
 * listener re-saves on every launch rather than only on the first.
 *
 * The plugin is imported rather than read off `window.Capacitor.Plugins`:
 * that global is only populated for plugins the JS layer has registered,
 * so reaching for it directly silently found nothing and the phone never
 * asked Firebase for a token.
 */

import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { sbPost, sbDelete } from "@/integrations/supabase/api";

/** Fired when the user taps a push notification. Carries the in-app route
 *  it should open, so the shell can navigate without a page reload. */
export const PUSH_OPENED_EVENT = "ldmove:push-opened";

/** True when running in the app, whatever the push state. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let registered = false;

/** Where registration got to, in words. Shown on the profile screen in
 *  the app: a phone that silently fails to register is indistinguishable
 *  from one that simply has nothing to announce, and there is no console
 *  to read on someone else's handset. */
let status = "not started";
const listeners = new Set<() => void>();

function setStatus(s: string) {
  status = s;
  listeners.forEach((fn) => fn());
}

export function getPushStatus(): string {
  return status;
}

export function onPushStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function registerForPush(userId: string): Promise<void> {
  if (!isNativeApp()) {
    setStatus("not the app");
    return;
  }
  if (registered) return;
  registered = true;

  try {
    setStatus("checking permission");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    // A refusal is a legitimate answer, not an error to retry on every
    // launch. The app keeps working, the phone just stays quiet.
    if (perm.receive !== "granted") {
      setStatus(`permission refused (${perm.receive})`);
      return;
    }

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener("registration", (token) => {
      if (!token?.value) return;
      setStatus("saving...");
      // Upsert: the same device relaunching must refresh last_seen_at
      // rather than fail on the primary key.
      void sbPost(
        "push_tokens?on_conflict=token",
        {
          token: token.value,
          user_id: userId,
          platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
          last_seen_at: new Date().toISOString(),
        },
        { merge: true }
      )
        .then(() => setStatus("active"))
        .catch((e) => setStatus(`could not save: ${String(e).slice(0, 120)}`));
    });

    await PushNotifications.addListener("registrationError", (e) => {
      setStatus(`Firebase refused: ${JSON.stringify(e).slice(0, 160)}`);
    });

    // Tapping a notification has to land on the thing it was about. The
    // route travels in the payload; the shell listens and navigates,
    // which keeps it a router transition instead of a full reload.
    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => {
        const link = (action?.notification?.data as { link_url?: string })
          ?.link_url;
        if (!link || !link.startsWith("/")) return;
        window.dispatchEvent(
          new CustomEvent(PUSH_OPENED_EVENT, { detail: { link } })
        );
      }
    );

    setStatus("asking Firebase...");
    await PushNotifications.register();
  } catch (e) {
    setStatus(`failed: ${String(e).slice(0, 160)}`);
  }
}

/** Called on sign-out: a borrowed or shared phone must stop ringing for
 *  someone who is no longer using it. */
export async function unregisterPush(token?: string): Promise<void> {
  if (!token) return;
  try {
    await sbDelete(`push_tokens?token=eq.${encodeURIComponent(token)}`);
  } catch (e) {
    console.error("could not remove the push token", e);
  }
}
