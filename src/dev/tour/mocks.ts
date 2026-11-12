/**
 * Demo data for the app tour slides (dev only, see tour.html).
 *
 * The slides render the app's real components, so they look exactly like
 * the app. Those components talk to Supabase; here every Supabase request
 * is answered locally with made-up data and nothing leaves the machine.
 * The "session" below is a placeholder that only these mocks accept: no
 * real account is signed into.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const DEMO_ID = "00000000-0000-4000-8000-000000000001";
const COACH_ID = "00000000-0000-4000-8000-000000000002";
export const RUN_NOW = "00000000-0000-4000-8000-0000000000aa";
const RUN_LAST = "00000000-0000-4000-8000-0000000000bb";

type Log = {
  id: string;
  set_number: number;
  reps_done: number | null;
  weight_kg: number | null;
  session_run_id: string;
  session_date: string;
  completed_at: string | null;
};

const run = (
  prefix: string,
  runId: string,
  date: string,
  reps: number[],
  completed: boolean
): Log[] =>
  reps.map((r, i) => ({
    id: `${prefix}-${i + 1}`,
    set_number: i + 1,
    reps_done: r,
    weight_kg: null,
    session_run_id: runId,
    session_date: date,
    completed_at: completed ? `${date}T09:00:00Z` : null,
  }));

/** Logs per exercise id. */
const LOGS: Record<string, Log[]> = {
  // Two sets done today, the third still to fill; last time 9, 8, 7.
  "tour-pike": [
    ...run("now", RUN_NOW, "2026-11-12", [8, 8], false),
    ...run("last", RUN_LAST, "2026-11-09", [9, 8, 7], true),
  ],
  // Every set filled, ready to complete.
  "tour-done": [
    ...run("now", RUN_NOW, "2026-11-12", [10, 10, 9], false),
    ...run("last", RUN_LAST, "2026-11-09", [9, 9, 8], true),
  ],
};

const COMMENTS = [
  {
    id: "tour-c1",
    item_id: "tour-question",
    author_id: DEMO_ID,
    author_role: "client",
    body: "My lower back arches when I kick up. Is that normal?",
    image_urls: null,
    parent_id: null,
    created_at: "2026-11-10T08:12:00Z",
    profiles: { first_name: "Sam", last_name: null },
  },
  {
    id: "tour-c2",
    item_id: "tour-question",
    author_id: COACH_ID,
    author_role: "coach",
    body: "A little at first, yes. Squeeze your glutes and pull your ribs in before you kick. Film your next set and send it, I'll check.",
    image_urls: null,
    parent_id: null,
    created_at: "2026-11-10T10:40:00Z",
    profiles: { first_name: "Maxime", last_name: "Ledieu" },
  },
];

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

export function installMocks() {
  // Ten days: long enough not to trigger a refresh while capturing, and
  // short enough for the refresh timer (a setTimeout) not to overflow.
  const expires = Math.floor(Date.now() / 1000) + 10 * 24 * 3600;
  const session = {
    access_token: "tour-demo",
    refresh_token: "tour-demo",
    expires_at: expires,
    user: { id: DEMO_ID, email: "demo@example.com" },
  };
  localStorage.setItem("ldmove-session", JSON.stringify(session));

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.startsWith(SUPABASE_URL)) return realFetch(input, init);
    const path = decodeURIComponent(url.slice(SUPABASE_URL.length));

    if (path.startsWith("/auth/v1/token")) {
      return json({ ...session, expires_in: 10 * 24 * 3600 });
    }
    if (path.startsWith("/auth/v1/user")) return json(session.user);
    if (path.startsWith("/rest/v1/profiles")) {
      return json([
        {
          id: DEMO_ID,
          email: "demo@example.com",
          role: "client",
          first_name: "Sam",
          last_name: null,
          avatar_url: null,
          language: "en",
        },
      ]);
    }
    if (path.startsWith("/rest/v1/workout_logs")) {
      const item = path.match(/program_item_id=eq\.([^&]+)/)?.[1] ?? "";
      return json(LOGS[item] ?? []);
    }
    if (path.startsWith("/rest/v1/exercise_comments")) {
      const item = path.match(/item_id=eq\.([^&]+)/)?.[1] ?? "";
      return json(COMMENTS.filter((c) => c.item_id === item));
    }
    // Anything else (reads, form check history, ...): empty.
    if ((init?.method ?? "GET").toUpperCase() === "GET") return json([]);
    return json([]);
  };
}
