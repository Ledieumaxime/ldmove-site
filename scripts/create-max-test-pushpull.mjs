// One-off: build the Push/Pull block requested by Maxime for the
// Max test account. Two sessions (push, pull), 3-4 exercises each.
//
// Usage: node scripts/create-max-test-pushpull.mjs
//
// The block is created as type=custom, assigned to Max test, published,
// not archived. Old block is expected to be archived already by the
// coach via the UI.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const TARGET_CLIENT_EMAIL = "ledieumaxime@icloud.com"; // Max test
const PROGRAM_TITLE = "Max test, Push/Pull";
const SLUG_PREFIX = "max-test-pushpull";
const DURATION_WEEKS = 2;

const envPath = path.join(ROOT, "ldmove-site", ".env.local");
const envRaw = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envRaw
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    })
);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

async function sb(method, p, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${p} → ${res.status}: ${txt}`);
  }
  return res.json();
}

// 1) Find Max test by email.
const profiles = await sb(
  "GET",
  `profiles?select=id,first_name,last_name,email&email=eq.${encodeURIComponent(
    TARGET_CLIENT_EMAIL
  )}&limit=1`
);
if (profiles.length === 0) {
  console.error(`No profile found for ${TARGET_CLIENT_EMAIL}`);
  process.exit(1);
}
const client = profiles[0];
console.log(
  `→ Target client: ${client.first_name ?? ""} ${client.last_name ?? ""} (${client.email})`
);

// 2) Create the program.
const slug = `${SLUG_PREFIX}-${Date.now().toString(36)}`;
const [program] = await sb("POST", "programs", {
  slug,
  title: PROGRAM_TITLE,
  description: "Push / pull split, 2 sessions per loop.",
  type: "custom",
  assigned_client_id: client.id,
  price_eur: 0,
  billing_type: "subscription",
  duration_weeks: DURATION_WEEKS,
  is_published: true,
  is_archived: false,
});
console.log(`→ Program created: ${program.id} (${program.slug})`);

// 3) Create the two weeks (= sessions).
const weeks = [
  { week_number: 1, title: "Push" },
  { week_number: 2, title: "Pull" },
];
const createdWeeks = [];
for (const w of weeks) {
  const [row] = await sb("POST", "program_weeks", {
    program_id: program.id,
    week_number: w.week_number,
    title: w.title,
    notes: null,
  });
  createdWeeks.push(row);
  console.log(`→ Week ${w.week_number} (${w.title}) → ${row.id}`);
}

// 4) Create the items per session.
const itemsByWeek = {
  1: [
    {
      order_index: 1,
      custom_name: "[WARMUP] Jeff curl",
      sets: 1,
      reps: "1 min",
      rest_seconds: 0,
      notes: null,
    },
    {
      order_index: 2,
      custom_name: "[WORKOUT] Dips",
      sets: 3,
      reps: "10",
      rest_seconds: 90,
      notes: null,
    },
    {
      order_index: 3,
      custom_name: "[WORKOUT] Push-up",
      sets: 4,
      reps: "20",
      rest_seconds: 90,
      notes: null,
    },
  ],
  2: [
    {
      order_index: 1,
      custom_name: "[WARMUP] Dead hang",
      sets: 2,
      reps: "1 min",
      rest_seconds: 30,
      notes: null,
    },
    {
      order_index: 2,
      custom_name: "[WORKOUT] Pull-up",
      sets: 3,
      reps: "10",
      rest_seconds: 90,
      notes: null,
    },
    {
      order_index: 3,
      custom_name: "[WORKOUT] Ring row",
      sets: 4,
      reps: "max rep",
      rest_seconds: 90,
      notes: null,
    },
  ],
};

for (const week of createdWeeks) {
  const items = itemsByWeek[week.week_number] ?? [];
  for (const it of items) {
    const payload = { ...it, week_id: week.id };
    await sb("POST", "program_items", payload);
    console.log(
      `   · w${week.week_number} #${it.order_index} ${it.custom_name} → ${it.sets}×${it.reps}`
    );
  }
}

console.log("\nDone. Program is live and assigned to Max test.");
console.log(`Slug: ${program.slug}`);
