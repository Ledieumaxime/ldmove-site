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
      if (!res.ok) return null;
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
  // Cap iterations to avoid infinite loops on a backend bug.
  for (let i = 0; i < 50; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await sbGet<T[]>(
      `${path}${sep}offset=${offset}&limit=${pageSize}`
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
