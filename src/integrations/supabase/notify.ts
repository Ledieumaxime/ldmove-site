// Small helper to invoke the notify-program-published edge function.
// Silent-failure: we never block the UI on notification delivery.

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

export async function notifyProgramPublished(programId: string): Promise<{ ok: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { ok: false, error: "Not signed in" };
  try {
    const res = await fetch(`${URL}/functions/v1/notify-program-published`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ program_id: programId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
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
  const token = getToken();
  if (!token) return { ok: false, error: "Not signed in" };
  try {
    const res = await fetch(`${URL}/functions/v1/delete-client`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_id: clientId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function cleanupArchivedVideos(programId: string): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  const token = getToken();
  if (!token) return { ok: false, error: "Not signed in" };
  try {
    const res = await fetch(`${URL}/functions/v1/cleanup-archived-videos`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ program_id: programId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, deleted: data.deleted };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
