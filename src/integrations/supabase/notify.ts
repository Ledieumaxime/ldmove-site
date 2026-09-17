// Calls into the Supabase edge functions: notifications, the comment
// rewrite, client deletion, archived video cleanup.

import { refreshAccessToken } from "@/integrations/supabase/api";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * POST to an edge function, renewing the session once if it has expired.
 *
 * Every function here checks the caller's session before doing anything,
 * and an access token lives one hour. The regular data helpers in api.ts
 * already renew it on a 401 and retry; these calls read the stored token
 * directly and never did. So after an hour on the same tab, all of them
 * failed with "Invalid token", including the push that tells a client
 * their coach has replied, which is silent by design and therefore
 * failed without a trace through every long review session.
 *
 * Returns null only when there is no session at all.
 */
async function callFunction(
  name: string,
  body: unknown
): Promise<Response | null> {
  let token = getToken();
  if (!token) return null;

  const send = (t: string) =>
    fetch(`${URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let res = await send(token);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      token = fresh;
      res = await send(fresh);
    }
  }
  return res;
}

export async function notifyProgramPublished(
  programId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callFunction("notify-program-published", {
      program_id: programId,
    });
    if (!res) return { ok: false, error: "Not signed in" };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Clean up a draft comment into the client's language.
 *
 *  Unlike the notifications around it, this one is NOT silent-failure:
 *  the coach is waiting on the result, so a failure has to say so
 *  rather than leave a button spinning over nothing.
 */
// Flat shape rather than a discriminated union: this project compiles
// with `strict: false`, where TypeScript cannot narrow `ok: true | false`
// and every caller would have to cast.
export async function rewriteComment(
  draft: string,
  clientId?: string | null
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const res = await callFunction("rewrite-comment", {
      draft,
      client_id: clientId ?? null,
    });
    if (!res) return { ok: false, error: "Not signed in" };
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, text: data.text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Ring the client's phone about a notification that was just created.
 *
 *  Call this right after inserting into `notifications`: the row is what
 *  the client sees inside the app, this is what reaches them when the app
 *  is closed. Silent-failure and deliberately not awaited by callers, the
 *  notification itself is already saved either way.
 *
 *  A client with no app installed simply has no device registered, which
 *  the function reports as `sent: 0` rather than as an error.
 */
export async function sendPush(
  userId: string,
  title: string,
  body?: string,
  linkUrl?: string,
  /** Pass "comment" for coach feedback. Those arrive in bursts, and the
   *  sender collapses a burst into one notification per review session. */
  type?: "comment"
): Promise<void> {
  try {
    const res = await callFunction("send-push", {
      user_id: userId,
      title,
      body: body ?? "",
      link_url: linkUrl ?? null,
      type: type ?? null,
    });
    // Still silent for the UI, but no longer invisible: a push that did
    // not go out now leaves something in the console to find.
    if (res && !res.ok) {
      console.error("push notification refused", res.status);
    }
  } catch (e) {
    console.error("push notification failed", e);
  }
}

export async function deleteClient(clientId: string): Promise<{
  ok: boolean;
  programs_deleted?: number;
  orphan_comments_deleted?: number;
  form_check_files_deleted?: number;
  assessment_files_deleted?: number;
  error?: string;
}> {
  try {
    const res = await callFunction("delete-client", { client_id: clientId });
    if (!res) return { ok: false, error: "Not signed in" };
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function cleanupArchivedVideos(
  programId: string
): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  try {
    const res = await callFunction("cleanup-archived-videos", {
      program_id: programId,
    });
    if (!res) return { ok: false, error: "Not signed in" };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, deleted: data.deleted };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
