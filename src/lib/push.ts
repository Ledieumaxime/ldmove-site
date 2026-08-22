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
 */

import { sbPost, sbDelete } from "@/integrations/supabase/api";

/** Fired when the user taps a push notification. Carries the in-app route
 *  it should open, so the shell can navigate without a page reload. */
export const PUSH_OPENED_EVENT = "ldmove:push-opened";

type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<unknown>;
  removeAllListeners: () => Promise<void>;
};

function nativePush(): PushPlugin | null {
  const cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { PushNotifications?: PushPlugin };
      };
    }
  ).Capacitor;
  if (typeof cap?.isNativePlatform !== "function" || !cap.isNativePlatform()) {
    return null;
  }
  return cap.Plugins?.PushNotifications ?? null;
}

/** True when running in the app, whatever the push state. */
export function isNativeApp(): boolean {
  return nativePush() !== null;
}

let registered = false;

export async function registerForPush(userId: string): Promise<void> {
  const push = nativePush();
  if (!push || registered) return;
  registered = true;

  try {
    let perm = await push.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await push.requestPermissions();
    }
    // A refusal is a legitimate answer, not an error to retry on every
    // launch. The app keeps working, the phone just stays quiet.
    if (perm.receive !== "granted") return;

    await push.removeAllListeners();

    await push.addListener("registration", (data: unknown) => {
      const token = (data as { value?: string })?.value;
      if (!token) return;
      // Upsert: the same device relaunching must refresh last_seen_at
      // rather than fail on the primary key.
      void sbPost(
        "push_tokens?on_conflict=token",
        {
          token,
          user_id: userId,
          platform: "android",
          last_seen_at: new Date().toISOString(),
        },
        { merge: true }
      ).catch((e) => console.error("could not save the push token", e));
    });

    await push.addListener("registrationError", (e: unknown) => {
      console.error("push registration failed", e);
    });

    // Tapping a notification has to land on the thing it was about. The
    // route travels in the payload; the shell listens and navigates,
    // which keeps it a router transition instead of a full reload.
    await push.addListener("pushNotificationActionPerformed", (data: unknown) => {
      const link = (data as { notification?: { data?: { link_url?: string } } })
        ?.notification?.data?.link_url;
      if (!link || !link.startsWith("/")) return;
      window.dispatchEvent(
        new CustomEvent(PUSH_OPENED_EVENT, { detail: { link } })
      );
    });

    await push.register();
  } catch (e) {
    console.error("push setup failed", e);
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
