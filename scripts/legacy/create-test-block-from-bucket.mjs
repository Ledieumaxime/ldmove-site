// Build a test block for Max test pulling random exercises from
// what's already in the Supabase `videos` bucket. Each exercise gets
// its display name resolved from bibliotheque.md and a 7-day signed
// URL so the videos play in-app right away.
//
// Usage: node scripts/create-test-block-from-bucket.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const TARGET_CLIENT_EMAIL = "ledieumaxime@icloud.com"; // Max test
const PROGRAM_TITLE = "Max test, Random Test Block";
const SLUG_PREFIX = "max-test-random-block";
const DURATION_WEEKS = 2;
const BUCKET = "videos";
const SESSIONS = [
  { week_number: 1, title: "Session A" },
  { week_number: 2, title: "Session B" },
  { week_number: 3, title: "Session C" },
];
const EXERCISES_PER_SESSION = 10;
const SIGNED_URL_EXPIRY_S = 7 * 24 * 60 * 60; // 7 days

// --- Env ---
const envPath = path.join(ROOT, "ldmove-site", ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
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
  console.error("Missing env");
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
    throw new Error(`${method} ${p} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function listBucketFiles() {
  // Storage list API: list root of bucket, paginate.
  const all = [];
  let offset = 0;
  for (let i = 0; i < 50; i++) {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix: "", limit: 1000, offset }),
      }
    );
    if (!res.ok)
      throw new Error(`list bucket → ${res.status}: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return all
    .filter((f) => f.name && /\.(mov|mp4|webm)$/i.test(f.name))
    .map((f) => f.name);
}

async function signUrl(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${filename}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_S }),
    }
  );
  if (!res.ok)
    throw new Error(`sign ${filename} → ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}`;
}

// --- Build slug → display name from bibliotheque.md ---
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const biblio = fs.readFileSync(
  path.join(ROOT, "Bibliothèque", "bibliotheque.md"),
  "utf8"
);
const slugToDisplay = new Map();
for (const line of biblio.split("\n")) {
  const m = line.match(/^\|\s*([^|]+?)\s*\|\s*https?:\/\//);
  if (!m) continue;
  const display = m[1].trim();
  if (display === "Exercise") continue; // table header
  slugToDisplay.set(slugify(display), display);
}
console.log(`Bibliotheque: ${slugToDisplay.size} known exercises`);

// --- Pull bucket files & cross-ref ---
const bucketFiles = await listBucketFiles();
console.log(`Bucket: ${bucketFiles.length} files uploaded so far`);

const usable = bucketFiles
  .map((f) => ({
    filename: f,
    slug: f.replace(/\.(mov|mp4|webm)$/i, ""),
  }))
  .filter((x) => slugToDisplay.has(x.slug))
  .map((x) => ({ ...x, display: slugToDisplay.get(x.slug) }));
console.log(`Cross-ref with bibliotheque: ${usable.length} usable`);

if (usable.length < SESSIONS.length * EXERCISES_PER_SESSION) {
  console.error(
    `Need ${SESSIONS.length * EXERCISES_PER_SESSION} usable exos, only have ${usable.length}.`
  );
  console.error(
    `Wait until more videos are uploaded, or shrink the test block.`
  );
  process.exit(1);
}

// Random shuffle (Fisher-Yates) and pick 30 distinct.
for (let i = usable.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [usable[i], usable[j]] = [usable[j], usable[i]];
}
const picked = usable.slice(0, SESSIONS.length * EXERCISES_PER_SESSION);

// Sign all picked URLs.
console.log(`Signing ${picked.length} URLs (7-day expiry)…`);
for (const ex of picked) {
  ex.signedUrl = await signUrl(ex.filename);
}

// --- Find Max test ---
const profiles = await sb(
  "GET",
  `profiles?select=id,first_name,email&email=eq.${encodeURIComponent(TARGET_CLIENT_EMAIL)}&limit=1`
);
if (profiles.length === 0) {
  console.error(`No profile for ${TARGET_CLIENT_EMAIL}`);
  process.exit(1);
}
const client = profiles[0];
console.log(`Target client: ${client.first_name} (${client.email})`);

// --- Create program ---
const slug = `${SLUG_PREFIX}-${Date.now().toString(36)}`;
const [program] = await sb("POST", "programs", {
  slug,
  title: PROGRAM_TITLE,
  description:
    "Random test block built from already-uploaded videos in the Supabase bucket.",
  type: "custom",
  assigned_client_id: client.id,
  price_eur: 0,
  billing_type: "subscription",
  duration_weeks: DURATION_WEEKS,
  is_published: true,
  is_archived: false,
});
console.log(`Program: ${program.id} (${program.slug})`);

// --- Create weeks ---
const createdWeeks = [];
for (const s of SESSIONS) {
  const [w] = await sb("POST", "program_weeks", {
    program_id: program.id,
    week_number: s.week_number,
    title: s.title,
    notes: null,
  });
  createdWeeks.push({ ...w, ...s });
}

// --- Create items: 10 per week, drawn from `picked` ---
let pickIndex = 0;
for (const w of createdWeeks) {
  for (let i = 0; i < EXERCISES_PER_SESSION; i++) {
    const ex = picked[pickIndex++];
    await sb("POST", "program_items", {
      week_id: w.id,
      order_index: i + 1,
      // Tag with [WORKOUT] so the section renders properly in-app.
      custom_name: `[WORKOUT] ${ex.display}`,
      sets: 3,
      reps: "10",
      rest_seconds: 60,
      notes: null,
      video_url: ex.signedUrl,
    });
    console.log(`   · ${w.title} #${i + 1} ${ex.display}`);
  }
}

console.log(`\nDone. Program "${program.title}" is live for Max test.`);
console.log(`Slug: ${program.slug}`);
console.log(
  `Open as Max test: ${SUPABASE_URL.replace("supabase.co", "")}/app/programs/${program.slug}`
);
