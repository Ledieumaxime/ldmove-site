// One-off: upload every .mov in the SSD library folder to a private
// Supabase Storage bucket called "videos", with slugified filenames.
//
// Usage: node scripts/upload-exercise-videos.mjs
//
// Outputs scripts/videos-mapping.json — a {original_name → storage_path}
// map used in the next phase to seed the `exercises` table.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const SOURCE_DIR = "/Volumes/Extreme SSD/Online video systeme";
const BUCKET = "videos";
// 500 MB per file. The longest demo videos stay well under this; if
// one ever exceeds, the upload simply fails for that file with a
// clear error and we adjust.
const FILE_SIZE_LIMIT = 500 * 1024 * 1024;

// --- Load env ---
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
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// --- Helpers ---
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // anything not alnum → hyphen
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, ""); // trim ends
}

async function bucketExists() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.ok;
}

async function createBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      // Don't pin file_size_limit — the project-level cap takes
      // priority on Supabase and rejects bucket-level overrides
      // above it. Upload errors per file will surface clearly.
      allowed_mime_types: ["video/quicktime", "video/mp4", "video/webm"],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to create bucket: ${res.status} ${txt}`);
  }
  console.log(`Bucket "${BUCKET}" created (private).`);
}

async function fileExists(storagePath) {
  // HEAD-equivalent via the info endpoint — returns 200 if the
  // object is in the bucket, 400/404 otherwise. Avoids re-uploading
  // anything that already made it across, so a crashed run can
  // simply be relaunched and pick up where it left off.
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/info/${BUCKET}/${storagePath}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  return res.ok;
}

async function uploadFile(localPath, storagePath) {
  const data = fs.readFileSync(localPath);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "video/quicktime",
        "x-upsert": "true",
      },
      body: data,
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`upload ${storagePath} → ${res.status}: ${txt.slice(0, 300)}`);
  }
}

// --- Main ---
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Target bucket: ${BUCKET} (private)\n`);

if (!(await bucketExists())) {
  await createBucket();
} else {
  console.log(`Bucket "${BUCKET}" already exists, reusing.`);
}

const all = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => /\.mov$/i.test(f) && !f.startsWith(".")) // skip macOS sidecars
  .sort();
console.log(`Found ${all.length} videos to upload.\n`);

// Sanity-check: detect slug collisions before we start.
const mapping = {};
const slugToOriginal = new Map();
for (const file of all) {
  const baseName = file.replace(/\.mov$/i, "");
  const slug = slugify(baseName) + ".mov";
  if (slugToOriginal.has(slug)) {
    console.error(
      `Slug collision: "${baseName}" and "${slugToOriginal.get(slug)}" both → ${slug}`
    );
    process.exit(1);
  }
  slugToOriginal.set(slug, baseName);
  mapping[baseName] = `${slug}`;
}
console.log("No slug collisions detected.\n");

let success = 0;
let skipped = 0;
let failed = 0;
const failures = [];
const startedAt = Date.now();

for (let i = 0; i < all.length; i++) {
  const file = all[i];
  const baseName = file.replace(/\.mov$/i, "");
  const slug = mapping[baseName];
  const localPath = path.join(SOURCE_DIR, file);
  const sizeMb = (fs.statSync(localPath).size / (1024 * 1024)).toFixed(1);
  const prefix = `[${(i + 1).toString().padStart(3, " ")}/${all.length}] ${baseName} (${sizeMb} MB)`;
  // Skip-if-already-there pass first: makes the script idempotent
  // so a crashed / interrupted run can simply be re-launched.
  try {
    if (await fileExists(slug)) {
      console.log(`${prefix} → already uploaded, skip.`);
      skipped++;
      continue;
    }
  } catch {
    // existence check failed, fall through to a real upload attempt
  }
  process.stdout.write(`${prefix} → ${slug} … `);
  try {
    await uploadFile(localPath, slug);
    process.stdout.write("✓\n");
    success++;
  } catch (e) {
    process.stdout.write("✗\n");
    console.error(`   ${e.message}`);
    failures.push({ file: baseName, error: e.message });
    failed++;
  }
}

const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1);

// Persist mapping for the next phase (seed exercises).
const mappingPath = path.join(
  ROOT,
  "ldmove-site",
  "scripts",
  "videos-mapping.json"
);
fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

console.log(`\n=== Summary ===`);
console.log(`Uploaded:  ${success}`);
console.log(`Skipped:   ${skipped} (already present)`);
console.log(`Failed:    ${failed}`);
console.log(`Total:     ${all.length}`);
console.log(`Elapsed:   ${elapsedMin} min`);
console.log(`Mapping:   ${mappingPath}`);
if (failures.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f.file}: ${f.error}`);
}
