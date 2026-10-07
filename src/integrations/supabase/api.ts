// Lightweight REST helper that uses the session access_token stored by AuthContext.
// We go through fetch directly because the supabase-js client hangs with the new
// publishable key format in this environment.

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

type StoredSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user?: unknown;
} | null;

const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s?.access_token ?? null;
  } catch {
    return null;
  }
};

// ---- Dead-session handling -------------------------------------------
// When the auth server DEFINITIVELY rejects a refresh token (revoked,
// rotated away, session deleted), the stored session can never recover:
// every request 401s forever and the app just looks broken (the "stuck
// after a long absence" failure). That case gets a clean sign-out +
// redirect to login. Transient failures (network blip, 5xx, rate
// limiting) still keep the session — signing someone out mid-workout
// over a blip stays the worst outcome.
const AUTH_PAGES = [
  "/app/login",
  "/app/signup",
  "/app/welcome",
  "/app/reset-password",
];

function isRefreshTokenDead(status: number, body: string): boolean {
  if (status < 400 || status >= 500) return false;
  if (status === 429) return false; // rate limited: retry later
  // Observed GoTrue bodies (2026-07): a revoked/unknown token returns
  // {"error_code":"refresh_token_not_found","msg":"Invalid Refresh
  // Token: Refresh Token Not Found"}; a malformed one returns
  // {"error_code":"validation_failed","msg":"Refresh token is not
  // valid"}. The other markers cover older GoTrue versions.
  const b = body.toLowerCase();
  return (
    b.includes("invalid_grant") ||
    b.includes("refresh_token_not_found") ||
    b.includes("invalid refresh token") ||
    b.includes("refresh token not found") ||
    b.includes("refresh token is not valid") ||
    b.includes("already used")
  );
}

function purgeDeadSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable; nothing to purge
  }
  // Let AuthContext drop its in-memory session/profile state too.
  window.dispatchEvent(new Event("ldmove:session-expired"));
  const path = window.location.pathname;
  if (path.startsWith("/app") && !AUTH_PAGES.some((p) => path.startsWith(p))) {
    window.location.replace("/app/login?expired=1");
  }
}

// Mint a fresh access token from the stored refresh_token and persist
// it. Returns the new token, or null if the refresh itself failed.
// Shared by every helper so a single expired/skewed token gets healed
// transparently instead of bubbling a 401/403 up to the UI (which was
// showing clients 'JWT expired' / 'claim timestamp check failed' mid
// workout).
let refreshInFlight: Promise<string | null> | null = null;
export async function refreshAccessToken(): Promise<string | null> {
  // Collapse concurrent refreshes (e.g. several set saves firing at
  // once) into one network call.
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as StoredSession;
      if (!session?.refresh_token) return null;
      const res = await fetch(
        `${URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: { apikey: KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (isRefreshTokenDead(res.status, body)) purgeDeadSession();
        return null;
      }
      const json = await res.json();
      const next = {
        access_token: json.access_token,
        refresh_token: json.refresh_token ?? session.refresh_token,
        expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        user: json.user ?? session.user,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return json.access_token as string;
    } catch {
      return null;
    } finally {
      // Allow the next refresh to actually run.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

// Core request runner with one automatic refresh+retry on 401/403.
async function request(
  method: string,
  path: string,
  init: Omit<RequestInit, "method"> = {}
): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${URL}/rest/v1/${path}`, {
      ...init,
      method,
      headers: {
        apikey: KEY,
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await send(getToken());
  if (res.status === 401 || res.status === 403) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }
  return res;
}

export async function sbGet<T>(path: string): Promise<T> {
  const res = await request("GET", path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Give a query a TOTAL order, so offset pagination is deterministic.
 *
 * Without an ORDER BY, or with one that leaves ties (order_index is the
 * same across every session of a program, created_at can collide), Postgres
 * is free to return rows in a different order on each page request. Page 2
 * then overlaps page 1 and some rows are never returned at all, silently.
 * Measured on 2026-10-07: Aman's 1742 completed sets fetched in two
 * unordered pages came back with 23 duplicates and 23 rows missing.
 *
 * So `id` is always the last sort key: appended as the whole order when
 * there is none, or as a tiebreaker after whatever the caller asked for.
 * Only the top-level `order=` is touched. An embedded one such as
 * `program_items.order=order_index.asc` sorts the nested array, not the
 * pages, and is left alone (the `.` before it keeps the match off it).
 *
 * Every table this app pages through has an `id` primary key, checked
 * against the live database when this was written.
 */
function withTotalOrder(path: string): string {
  const q = path.indexOf("?");
  const query = q === -1 ? "" : path.slice(q + 1);
  const m = query.match(/(?:^|&)order=([^&]*)/);
  if (!m) return `${path}${q === -1 ? "?" : "&"}order=id.asc`;
  const keys = m[1].split(",").map((k) => k.split(".")[0]);
  if (keys.includes("id")) return path;
  return path.replace(
    /([?&])order=([^&]*)/,
    (_all, sep: string, val: string) => `${sep}order=${val},id.asc`
  );
}

/**
 * Fetch every row from a PostgREST endpoint by paginating, regardless
 * of the server's max-rows ceiling (Supabase enforces ~1000 even when
 * the URL passes ?limit=50000). Loops with offset+limit until a page
 * comes back smaller than the page size.
 *
 * Use only when you genuinely need every row — cross-program counts,
 * coach dashboards, etc. Anything filtered down to a single client's
 * data is safe with the regular sbGet because it stays well below
 * 1000 rows.
 */
export async function sbGetAll<T>(
  path: string,
  pageSize = 1000
): Promise<T[]> {
  const result: T[] = [];
  let offset = 0;
  const ordered = withTotalOrder(path);
  // Cap iterations to avoid infinite loops on a backend bug.
  for (let i = 0; i < 50; i++) {
    const sep = ordered.includes("?") ? "&" : "?";
    const page = await sbGet<T[]>(
      `${ordered}${sep}offset=${offset}&limit=${pageSize}`
    );
    result.push(...page);
    if (page.length < pageSize) return result;
    offset += pageSize;
  }
  return result;
}

/**
 * Fetch rows matching an `in.(...)` filter on a potentially long id
 * list. Two ceilings are handled at once:
 *   - URL length: the id list is chunked (60 uuids ≈ 2.2KB per URL).
 *   - Server max-rows (~1000): each chunk goes through sbGetAll which
 *     paginates past the cap.
 * Use for "all logs of this program's items"-style queries where the
 * id list and the result set can both grow unbounded over time.
 */
export async function sbGetIn<T>(
  basePath: string,
  column: string,
  ids: string[],
  chunkSize = 60
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const sep = basePath.includes("?") ? "&" : "?";
    const rows = await sbGetAll<T>(
      `${basePath}${sep}${column}=in.(${chunk.join(",")})`
    );
    out.push(...rows);
  }
  return out;
}

/**
 * Sign a storage object URL with the same refresh-and-retry behaviour
 * as the REST helpers. Components used to hand-roll this with a raw
 * fetch + the localStorage token; since the auth layer stopped
 * dropping stale sessions (to avoid logging users out mid-workout on
 * skewed clocks), a raw call can run with an expired token and fail
 * silently — which showed up as "the coach can't play form-check
 * videos". Going through this helper heals the token first.
 * Returns the full playable URL, or null if signing failed.
 */
export async function sbSignUrl(
  bucket: string,
  path: string,
  expiresIn = 1800
): Promise<string | null> {
  const send = (token: string | null) =>
    fetch(
      `${URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path}`,
      {
        method: "POST",
        headers: {
          apikey: KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ expiresIn }),
      }
    );
  try {
    let res = await send(getToken());
    if (res.status === 401 || res.status === 403) {
      const fresh = await refreshAccessToken();
      if (fresh) res = await send(fresh);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const signed = data.signedURL ?? data.signedUrl;
    return signed ? `${URL}/storage/v1${signed}` : null;
  } catch {
    return null;
  }
}

export async function sbPost<T>(
  path: string,
  body: unknown,
  options?: { merge?: boolean }
): Promise<T> {
  // PostgREST upsert: combine "resolution=merge-duplicates" with the
  // on_conflict query param the caller adds to the path.
  const prefer = options?.merge
    ? "resolution=merge-duplicates,return=representation"
    : "return=representation";
  const res = await request("POST", path, {
    headers: { "Content-Type": "application/json", Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function sbPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await request("PATCH", path, {
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function sbDelete(path: string): Promise<void> {
  const res = await request("DELETE", path);
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status} ${await res.text()}`);
}

/**
 * Call an Edge Function anonymously (public forms: contact / apply).
 * Replaces supabase-js's functions.invoke: importing the whole client
 * library for two forms added ~100KB to the bundle, and that client
 * hangs with the new publishable key format anyway.
 */
export async function sbInvokeAnon(name: string, body: unknown): Promise<void> {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} → ${res.status} ${await res.text()}`);
}
