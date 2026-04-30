// Lightweight REST helper that uses the session access_token stored by AuthContext.
// We go through fetch directly because the supabase-js client hangs with the new
// publishable key format in this environment.

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "ldmove-session";

type StoredSession = { access_token: string } | null;

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

export async function sbGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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

export async function sbPost<T>(
  path: string,
  body: unknown,
  options?: { merge?: boolean }
): Promise<T> {
  const token = getToken();
  // PostgREST upsert: combine "resolution=merge-duplicates" with the
  // on_conflict query param the caller adds to the path.
  const prefer = options?.merge
    ? "resolution=merge-duplicates,return=representation"
    : "return=representation";
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      "Content-Type": "application/json",
      Prefer: prefer,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function sbPatch<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function sbDelete(path: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status} ${await res.text()}`);
}
