// Seed exercises needed by Hamza's bloc 1.
// - Existing biblio exos: signed URL from bucket
// - 5 new exos (Dips, Hip thrust, Leg press, Incline DB press,
//   Hamstring curl floor): video_url = null (gym exos or pending video)
//
// Wipes exercises table first (FK is ON DELETE SET NULL).

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const BLOC = path.join(ROOT, "Clients", "Hamza", "hamza_bloc_1_may.md");
const REVIEW = path.join(ROOT, "Bibliothèque", "bibliotheque-review.md");
const BUCKET = "videos";
const SIGNED_URL_EXPIRY_S = 365 * 24 * 60 * 60;

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "ldmove-site", ".env.local"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => { const eq = l.indexOf("="); return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]; })
);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

function slugify(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function signUrl(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${filename}`,
    { method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_S }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}`;
}

// 1. Get bucket file list
const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ limit: 500, prefix: "" }),
});
const bucketFiles = new Set((await bucketRes.json()).map((f) => f.name));

// 2. Library names (from review file — canonical)
const reviewMd = fs.readFileSync(REVIEW, "utf8");
const libByLower = new Map();
for (const raw of reviewMd.split("\n")) {
  if (!raw.startsWith("| ")) continue;
  const cells = raw.split("|").slice(1, -1).map((c) => c.trim());
  if (!cells[0] || /^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0])) continue;
  if (!cells[1] || !cells[1].startsWith("`")) continue;
  libByLower.set(cells[0].toLowerCase(), cells[0]);
}

// 3. Bloc unique exercise names
const blocMd = fs.readFileSync(BLOC, "utf8");
const bloc = new Set();
for (const raw of blocMd.split("\n")) {
  const line = raw.trim();
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 2) continue;
  const name = cells[0].replace(/\*\*/g, "").trim();
  if (!name) continue;
  if (/^Exercise$/i.test(name)) continue;
  if (/^[-: ]+$/.test(name)) continue;
  if (/^SUPERSET/i.test(name)) continue;
  if (/^SET\s+\d/i.test(name)) continue;
  if (/^SPINE MOBILITY/i.test(name)) continue;
  bloc.add(name);
}

// 4. Build payload
const payload = [];
for (const name of bloc) {
  const canon = libByLower.get(name.toLowerCase()) || name;
  const slug = slugify(canon);
  const filename = `${slug}.mov`;
  let video_url = null;
  if (bucketFiles.has(filename)) {
    video_url = await signUrl(filename);
  }
  payload.push({ name: canon, video_url, description: null, tags: ["bloc-hamza-1"] });
}

const withVideo = payload.filter((p) => p.video_url).length;
const withoutVideo = payload.length - withVideo;
console.log(`${payload.length} exercises ready: ${withVideo} with video, ${withoutVideo} without.`);
console.log(`Without video:`);
for (const p of payload) if (!p.video_url) console.log(`  - ${p.name}`);

// 5. Wipe + insert
console.log("\nWiping exercises table…");
await fetch(`${SUPABASE_URL}/rest/v1/exercises?id=neq.00000000-0000-0000-0000-000000000000`, {
  method: "DELETE",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "return=minimal" },
});

console.log(`Inserting ${payload.length} rows…`);
const res = await fetch(`${SUPABASE_URL}/rest/v1/exercises`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error(`insert: ${res.status} ${await res.text()}`);
const inserted = await res.json();
console.log(`✓ Inserted ${inserted.length} rows.`);
