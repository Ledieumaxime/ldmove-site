// Parse Bibliothèque/bibliotheque.md and seed the public.exercises
// table with one row per known exercise. Cross-references the bucket
// `videos/` to make sure each exercise has a corresponding file.
//
// Run AFTER all 197 videos are uploaded to the videos bucket.
//
// Behaviour:
//   - Idempotent: re-running upserts on `name`, doesn't duplicate.
//   - For each exercise, store the bucket-relative path in
//     exercises.video_url (e.g. "strict-pull-up.mov"). The app will
//     sign it on demand.
//   - Tags = [Face, Node, Level] extracted from the markdown
//     section hierarchy.
//   - Logs anything that doesn't match (typo in bibliotheque vs file,
//     missing file in bucket, etc.) so the coach can fix the source
//     of truth.
//
// Usage: node scripts/seed-exercises-from-md.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const BIBLIO_PATH = path.join(ROOT, "Bibliothèque", "bibliotheque.md");
const BUCKET = "videos";

// --- Env ---
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, "ldmove-site", ".env.local"), "utf8")
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

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function sb(method, p, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(`${method} ${p} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listBucket() {
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
    if (!res.ok) throw new Error(`bucket list: ${res.status}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return new Set(
    all.filter((f) => /\.(mov|mp4|webm)$/i.test(f.name)).map((f) => f.name)
  );
}

// --- Parse bibliotheque.md ---
// Track section hierarchy: Face (## FACE …) → Node (### …)
// Each table row "| Exercise | https… |" becomes one entry.
const lines = fs.readFileSync(BIBLIO_PATH, "utf8").split("\n");
const entries = [];
let face = null;
let node = null;
for (const raw of lines) {
  const line = raw.trim();
  // Section header: "## FACE 2 — CALISTHENICS (Skill Tree)"
  let m = line.match(/^##\s+(?:[^A-Z]*)?(FACE\s+\d+\s*—.+?)(?:\s*\(.*\))?$/i);
  if (m) {
    face = m[1].trim();
    node = null;
    continue;
  }
  // Sub-header: "### BASE — Pull" or "### LVL 2 — Tuck Planche"
  m = line.match(/^###\s+(.+)$/);
  if (m) {
    node = m[1].trim();
    continue;
  }
  // Table row with a Drive URL: "| Name | https://… |"
  m = line.match(/^\|\s*([^|]+?)\s*\|\s*(https?:\/\/[^|\s]+)\s*\|/);
  if (m) {
    const name = m[1].trim();
    if (name === "Exercise" || /^[-: ]+$/.test(name)) continue;
    entries.push({ name, face, node });
  }
}
console.log(`Parsed ${entries.length} entries from bibliotheque.md`);

// --- Cross-ref with bucket ---
console.log(`Listing bucket "${BUCKET}"…`);
const bucketFiles = await listBucket();
console.log(`Found ${bucketFiles.size} videos in bucket\n`);

const ready = [];
const missingFiles = [];
const slugSeen = new Set();
const slugCollisions = [];
for (const e of entries) {
  const slug = slugify(e.name);
  const filename = `${slug}.mov`;
  if (slugSeen.has(slug)) {
    slugCollisions.push({ name: e.name, slug });
    continue;
  }
  slugSeen.add(slug);
  if (!bucketFiles.has(filename)) {
    missingFiles.push({ name: e.name, expectedFile: filename });
    continue;
  }
  ready.push({
    name: e.name,
    video_url: filename,
    tags: [e.face, e.node].filter(Boolean),
  });
}

if (slugCollisions.length > 0) {
  console.log(`⚠ ${slugCollisions.length} slug collisions (skipped):`);
  for (const c of slugCollisions)
    console.log(`   "${c.name}" → ${c.slug} (already taken)`);
}
if (missingFiles.length > 0) {
  console.log(`⚠ ${missingFiles.length} entries with no matching file:`);
  for (const m of missingFiles.slice(0, 20))
    console.log(`   "${m.name}" expected ${m.expectedFile}`);
  if (missingFiles.length > 20)
    console.log(`   …and ${missingFiles.length - 20} more`);
}
console.log(`\n${ready.length} entries ready to upsert.\n`);

if (ready.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// --- Upsert into exercises ---
// We rely on (name) being unique via a soft contract — there's no
// existing unique constraint, so we DELETE-then-INSERT to keep things
// clean. Safer: check existing names first and only insert new ones.
const existing = await sb("GET", "exercises?select=id,name");
const existingNames = new Set(existing.map((x) => x.name.toLowerCase()));
const toInsert = ready.filter((r) => !existingNames.has(r.name.toLowerCase()));
const toUpdate = ready.filter((r) => existingNames.has(r.name.toLowerCase()));

console.log(`To insert: ${toInsert.length}`);
console.log(`To update (already in table): ${toUpdate.length}`);

if (toInsert.length > 0) {
  // Batch in chunks of 100 to respect PostgREST request size.
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    await sb("POST", "exercises", batch);
    console.log(`  inserted ${i + batch.length}/${toInsert.length}`);
  }
}

// Update video_url + tags on existing rows so re-running normalises.
for (const r of toUpdate) {
  const target = existing.find(
    (x) => x.name.toLowerCase() === r.name.toLowerCase()
  );
  if (!target) continue;
  await sb(
    "PATCH",
    `exercises?id=eq.${target.id}`,
    { video_url: r.video_url, tags: r.tags }
  );
}
if (toUpdate.length > 0) console.log(`  updated ${toUpdate.length} rows`);

console.log(`\n✓ Done.`);
