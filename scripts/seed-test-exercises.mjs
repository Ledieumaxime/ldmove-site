// Seed only the 30 exercises used by bloc_test_videos.md.
// Idempotent: wipes the exercises table first (FK is ON DELETE SET NULL,
// so live programs aren't broken). Use this just to test video playback
// before the full validation/seed.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const BUCKET = "videos";
const SIGNED_URL_EXPIRY_S = 365 * 24 * 60 * 60;

const EXOS = [
  "Full push up","Diamond push up","Pseudo planche push up","Pike Push-Up",
  "Elevated Pike push up","Tuck shoulder stand","Planche lean","L-Sit to Tuck Planche",
  "Scapula push up","Plank","Strict pull up","Chin up","Full ring row",
  "Bend over row elbow high & outside","Biceps ring","Dead hang",
  "Hanging scapula retraction","Skin the cat","Tuck dragon flag","Hanging leg raise",
  "Box Pistol Squat","Shrimp Squat 1","Sissy squat","Elevated Lunge Hold",
  "Assisted reverse nordic curl","Couch stretch","90/90 CARs","Jefferson curl",
  "Butterfly stretch","Banded shoulder dislocates",
];

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
  if (!res.ok) throw new Error(`sign ${filename}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}`;
}

console.log(`Signing ${EXOS.length} URLs…`);
const payload = [];
for (const name of EXOS) {
  const filename = `${slugify(name)}.mov`;
  const url = await signUrl(filename);
  payload.push({ name, video_url: url, description: null, tags: ["test"] });
}

console.log("Wiping exercises table…");
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
console.log(`✓ Inserted ${inserted.length} test exercises.`);
