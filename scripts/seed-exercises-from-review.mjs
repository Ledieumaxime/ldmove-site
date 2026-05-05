// Seed the Supabase `exercises` table from the validated review file
// (Bibliothèque/bibliotheque-review.md).
//
// For each row marked "V" in the ✓ column:
//   - Verify the corresponding video exists in the `videos` bucket.
//   - Generate a 1-year signed URL.
//   - INSERT into `exercises` with name, video_url, description, tags.
//
// Anything not validated yet is skipped (so the script is safe to
// re-run as the coach validates more rows over time). Existing rows
// in `exercises` are wiped first so the seed is deterministic — DB
// FK on program_items.exercise_id is ON DELETE SET NULL, so live
// programs aren't broken (they still have their own video_url).
//
// Usage: node scripts/seed-exercises-from-review.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const REVIEW = path.join(ROOT, "Bibliothèque", "bibliotheque-review.md");
const BUCKET = "videos";
const SIGNED_URL_EXPIRY_S = 365 * 24 * 60 * 60; // 1 year

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
  if (!res.ok)
    throw new Error(`${method} ${p} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fileExists(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/info/${BUCKET}/${filename}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  return res.ok;
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

// --- Parse review file ---
const review = fs.readFileSync(REVIEW, "utf8");
const lines = review.split("\n");
const rows = [];
let currentSection = null;
for (const raw of lines) {
  const line = raw.trim();
  // Section header `## FACE 2 — CALISTHENICS / BASE — Push`
  let m = line.match(/^##\s+(.+)$/);
  if (m && !line.startsWith("###")) {
    currentSection = m[1].replace(/^[⚠ ]+/, "").trim();
    continue;
  }
  if (!line.startsWith("|")) continue;
  // Table row
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 4) continue;
  if (
    /^Exercise$/i.test(cells[0]) ||
    /^[-: ]+$/.test(cells[0]) ||
    cells[0] === ""
  )
    continue;
  const [name, fileCell, descCell, tickCell] = cells;
  const validated = /^v$/i.test(tickCell) || /^✓$/.test(tickCell);
  if (!validated) continue;
  const filenameMatch = fileCell.match(/`([^`]+)`/);
  const filename = filenameMatch ? filenameMatch[1] : null;
  if (!filename) continue;
  rows.push({
    name,
    filename,
    description: descCell.replace(/\\\|/g, "|").trim() || null,
    section: currentSection,
  });
}
console.log(`Validated rows in review: ${rows.length}`);
if (rows.length === 0) {
  console.error(
    "Nothing to seed yet — validate some rows in bibliotheque-review.md first."
  );
  process.exit(0);
}

// --- Verify each file is on Supabase + sign URLs ---
console.log("Verifying files in bucket and signing URLs…");
let missingInBucket = 0;
for (const r of rows) {
  if (!(await fileExists(r.filename))) {
    console.error(`  MISSING in bucket: ${r.filename}`);
    missingInBucket++;
    continue;
  }
  r.signedUrl = await signUrl(r.filename);
}
if (missingInBucket > 0) {
  console.error(
    `\n${missingInBucket} files missing from bucket. Upload them before re-running.`
  );
  process.exit(1);
}

// --- Wipe existing exercises ---
console.log("Wiping existing exercises…");
await fetch(`${SUPABASE_URL}/rest/v1/exercises?id=neq.00000000-0000-0000-0000-000000000000`, {
  method: "DELETE",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: "return=minimal",
  },
});

// --- Insert all in one batch ---
const payload = rows.map((r) => ({
  name: r.name,
  video_url: r.signedUrl,
  description: r.description,
  tags: r.section ? [r.section] : [],
}));
console.log(`Inserting ${payload.length} exercises…`);
const inserted = await sb("POST", "exercises", payload);
console.log(`✓ Inserted ${inserted.length} rows into exercises.`);

console.log("\nDone. Library is now in Supabase.");
console.log(
  `Re-run this script after validating more rows, or after re-recording videos.`
);
