// Sending to iPhones through Apple (APNs), shared by send-push.
//
// iPhones go to Apple directly, not through Firebase: the iOS app registers
// with Apple and stores Apple's device token (push_tokens.platform 'ios').
// Auth is a token-based .p8 key from the Apple developer account, held in
// the APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY_B64 / APNS_BUNDLE_ID
// secrets, and signed ES256 here.
// deno-lint-ignore-file no-explicit-any

export function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function b64url(bytes: Uint8Array | string): string {
  const str =
    typeof bytes === "string"
      ? bytes
      : String.fromCharCode(...Array.from(bytes));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Apple's provider token, reused across sends. Apple accepts one for an
 *  hour and refuses tokens refreshed more often than every 20 minutes, so
 *  a fresh one every 50 minutes stays inside both limits. */
let apnsToken: { value: string; iat: number } | null = null;

async function getApnsToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (apnsToken && now - apnsToken.iat < 50 * 60) return apnsToken.value;
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyB64 = Deno.env.get("APNS_PRIVATE_KEY_B64");
  if (!keyId || !teamId || !keyB64) throw new Error("APNs not configured");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(atob(keyB64)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signingInput = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64url(
    JSON.stringify({ iss: teamId, iat: now })
  )}`;
  // WebCrypto returns ECDSA signatures as raw r||s, which is exactly the
  // JWS ES256 format: no DER unwrapping needed.
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput)
    )
  );
  apnsToken = { value: `${signingInput}.${b64url(sig)}`, iat: now };
  return apnsToken.value;
}

/** One notification to one iPhone. "stale" means the token will never
 *  work again and should be dropped; `detail` is Apple's answer, kept for
 *  logs and checks. */
export async function sendApns(
  deviceToken: string,
  title: string,
  body: string,
  linkUrl?: string
): Promise<{ result: "sent" | "stale" | "error"; detail: string }> {
  const jwt = await getApnsToken();
  const topic = Deno.env.get("APNS_BUNDLE_ID") ?? "com.ldmove.app";
  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: "default" },
    // Read by the app when the notification is tapped (src/lib/push.ts),
    // like the `data.link_url` Firebase delivers on Android.
    ...(linkUrl ? { link_url: linkUrl } : {}),
  });
  const post = (host: string) =>
    fetch(`https://${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: payload,
    });

  let res = await post("api.push.apple.com");
  let err: any = res.ok ? null : await res.json().catch(() => ({}));
  // TestFlight and the App Store register with Apple's production servers,
  // a build run straight from Xcode with the sandbox. Production answers a
  // sandbox token with BadDeviceToken, so try the sandbox before giving up.
  if (!res.ok && err?.reason === "BadDeviceToken") {
    res = await post("api.sandbox.push.apple.com");
    err = res.ok ? null : await res.json().catch(() => ({}));
  }
  const detail = `${res.status} ${err?.reason ?? "ok"}`;
  if (res.ok) return { result: "sent", detail };
  if (
    res.status === 410 ||
    err?.reason === "Unregistered" ||
    err?.reason === "BadDeviceToken"
  ) {
    return { result: "stale", detail };
  }
  console.error("apns send failed", detail);
  return { result: "error", detail };
}
