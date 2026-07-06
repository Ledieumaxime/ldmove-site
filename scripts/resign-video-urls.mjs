// Re-sign every video URL with a 10-YEAR expiry.
//
// Context: the original seeds signed URLs for 1 year, which set a
// silent time bomb — in June 2027 every exercise video would have
// died at once. Signed URLs are just JWTs; Supabase accepts arbitrary
// expiresIn, so we push expiry to 10 years and stop thinking about it.
//
// Touches:
//   - exercises.video_url        (every row pointing at Videos Mp4)
//   - program_items.video_url    (non-archived programs only — archived
//     blocs are history; their links dying is acceptable)
//
// Idempotent: re-running just re-signs from the current date.
// Run again before 2036, or after re-uploading any video file.
//
// Usage: node scripts/resign-video-urls.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const BUCKET = "Videos Mp4";
const EXPIRY_S = 10 * 365 * 24 * 60 * 60; // 10 years

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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Extract "<filename>" from any storage URL pointing at the bucket.
const fileOf = (url) => {
  if (!url) return null;
  const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

async function signUrl(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(BUCKET)}/${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: EXPIRY_S }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}`;
}

// Cache: one signature per distinct file.
const signedCache = new Map();
async function freshUrlFor(currentUrl) {
  const file = fileOf(currentUrl);
  if (!file) return null; // not a bucket URL (YouTube link, null, …)
  if (signedCache.has(file)) return signedCache.get(file);
  const fresh = await signUrl(file);
  signedCache.set(file, fresh);
  return fresh;
}

// ---- 1. exercises ----
const exercises = await (await fetch(
  `${SUPABASE_URL}/rest/v1/exercises?select=id,name,video_url&limit=2000`,
  { headers: HEADERS }
)).json();
let exoUpdated = 0;
let exoSkipped = 0;
for (const e of exercises) {
  const fresh = await freshUrlFor(e.video_url);
  if (!fresh) {
    exoSkipped++;
    continue;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/exercises?id=eq.${e.id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ video_url: fresh }),
  });
  if (r.ok) exoUpdated++;
  else console.error(`  exercises ${e.name}: ${r.status}`);
}
console.log(`exercises: ${exoUpdated} re-signed · ${exoSkipped} skipped (no bucket URL)`);

// ---- 2. program_items of non-archived programs ----
const programs = await (await fetch(
  `${SUPABASE_URL}/rest/v1/programs?select=id&is_archived=eq.false`,
  { headers: HEADERS }
)).json();
let itemUpdated = 0;
let itemSkipped = 0;
for (const p of programs) {
  const weeks = await (await fetch(
    `${SUPABASE_URL}/rest/v1/program_weeks?select=id&program_id=eq.${p.id}`,
    { headers: HEADERS }
  )).json();
  if (weeks.length === 0) continue;
  const items = await (await fetch(
    `${SUPABASE_URL}/rest/v1/program_items?select=id,video_url&week_id=in.(${weeks
      .map((w) => w.id)
      .join(",")})&limit=1000`,
    { headers: HEADERS }
  )).json();
  for (const it of items) {
    const fresh = await freshUrlFor(it.video_url);
    if (!fresh) {
      itemSkipped++;
      continue;
    }
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/program_items?id=eq.${it.id}`,
      {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ video_url: fresh }),
      }
    );
    if (r.ok) itemUpdated++;
  }
}
console.log(
  `program_items (active programs): ${itemUpdated} re-signed · ${itemSkipped} skipped`
);
console.log(
  `\n✓ Done. All URLs now valid until ${new Date(Date.now() + EXPIRY_S * 1000).toISOString().slice(0, 10)}.`
);
