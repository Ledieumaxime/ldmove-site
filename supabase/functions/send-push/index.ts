// Ring a client's phone.
//
// The in-app `notifications` table only reaches someone who thinks to open
// the app. This delivers the same message to the device itself, which is
// the whole reason the Android app exists.
//
// FCM's legacy server-key endpoint is gone, so this does what the Firebase
// SDK does under the hood: sign a JWT with the service account, trade it
// for a short-lived OAuth token, then POST to the v1 send endpoint. Doing
// it by hand avoids pulling the whole Admin SDK into an edge function.
//
// Coach-only, or callable with the service role from another function.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

/** How long one "your coach reviewed your work" notification stands for.
 *  An hour covers a normal review session; a coach who works longer than
 *  that has genuinely started a second one. */
const COMMENT_PUSH_WINDOW_MS = 60 * 60 * 1000;

/** Google's OAuth token, cached for the life of this isolate. Minting one
 *  costs a round trip and an RSA signature; they last an hour and a burst
 *  of notifications would otherwise pay for it on every single send. */
let cachedToken: { value: string; expiresAt: number } | null = null;

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function b64url(bytes: Uint8Array | string): string {
  const str =
    typeof bytes === "string"
      ? bytes
      : String.fromCharCode(...Array.from(bytes));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // 60s of margin: a token that expires mid-request is a failed send.
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput)
    )
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth failed: ${res.status} ${JSON.stringify(data)}`);
  }
  cachedToken = { value: data.access_token, expiresAt: now + 3500 };
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rawSa = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!rawSa) return json({ error: "Firebase not configured" }, 500);
    const sa: ServiceAccount = JSON.parse(rawSa);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Two callers: the coach from the app, or another edge function using
    // the service role. Anything else is refused.
    const token = (req.headers.get("Authorization") ?? "").replace(
      "Bearer ",
      ""
    );
    if (!token) return json({ error: "Not authenticated" }, 401);
    if (token !== serviceRoleKey) {
      const { data: userRes } = await admin.auth.getUser(token);
      if (!userRes?.user) return json({ error: "Invalid token" }, 401);
      const { data: caller } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (caller?.role !== "coach") return json({ error: "Coach only" }, 403);
    }

    const { user_id, title, body, link_url, type } = await req.json();
    if (!user_id || !title) {
      return json({ error: "user_id and title required" }, 400);
    }

    // Answering a stack of form checks in one sitting must not ring the
    // client's phone once per reply. What they need to know is that their
    // coach looked at their training, which is one event per session
    // however many comments it holds. Every comment still lands in the
    // inbox with its unread badge, so nothing is lost but the noise.
    //
    // The window runs from the notification we sent, not from the last
    // comment written: otherwise a coach who keeps typing would keep
    // pushing the deadline back and the client would never hear anything.
    if (type === "comment") {
      const { data: target } = await admin
        .from("profiles")
        .select("last_comment_push_at")
        .eq("id", user_id)
        .maybeSingle();
      const last = target?.last_comment_push_at
        ? new Date(target.last_comment_push_at).getTime()
        : 0;
      if (Date.now() - last < COMMENT_PUSH_WINDOW_MS) {
        return json({ sent: 0, reason: "throttled" });
      }
    }

    const { data: devices } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", user_id);

    if (!devices?.length) {
      // Not an error: plenty of clients never install the app. The in-app
      // notification still exists for them.
      return json({ sent: 0, reason: "no device registered" });
    }

    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let sent = 0;
    const stale: string[] = [];

    for (const d of devices) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: d.token,
            notification: { title, body: body ?? "" },
            // Read by the app when the user taps the notification, so it
            // opens on the thing the message is about.
            data: link_url ? { link_url } : {},
            android: {
              priority: "high",
              notification: {
                // Without a tag, Firebase falls back to one shared per
                // app, so every notification replaces the last one in the
                // drawer: archive a milestone then publish a program and
                // the client only ever sees the program. A unique tag
                // makes them stack, which is what someone expects of
                // messages about different things.
                tag: crypto.randomUUID(),
              },
            },
          },
        }),
      });

      if (res.ok) {
        sent++;
        continue;
      }
      const err = await res.json().catch(() => ({}));
      const status = err?.error?.details?.[0]?.errorCode ?? err?.error?.status;
      // The device is gone: app uninstalled, data cleared, token rotated.
      // Keeping it would mean retrying forever on something that will
      // never answer.
      if (status === "UNREGISTERED" || res.status === 404) {
        stale.push(d.token);
      } else {
        console.error("fcm send failed", res.status, JSON.stringify(err));
      }
    }

    if (stale.length) {
      await admin.from("push_tokens").delete().in("token", stale);
    }

    // Only start the quiet window once a phone has actually been rung.
    // Stamping it on a failed send would silence the next hour over a
    // notification the client never got.
    if (type === "comment" && sent > 0) {
      await admin
        .from("profiles")
        .update({ last_comment_push_at: new Date().toISOString() })
        .eq("id", user_id);
    }

    return json({ sent, devices: devices.length, pruned: stale.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
