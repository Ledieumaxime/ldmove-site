// Switch all video_url references from the old `videos` bucket (.mov)
// to the new `Videos Mp4` bucket (.mp4).
//
// - Re-signs URLs for every exercise in the `exercises` library that
//   currently points to a .mov file, mapping basename.mov →
//   basename.mp4 in the new bucket.
// - Updates `exercises.video_url` for all 198 rows.
// - Updates `program_items.video_url` for any active item still using
//   a .mov URL.
// - Idempotent: skips rows already on .mp4.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const OLD_BUCKET = "videos";
const NEW_BUCKET = "Videos Mp4";
const SIGNED_URL_EXPIRY_S = 365 * 24 * 60 * 60;

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "ldmove-site", ".env.local"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => { const eq = l.indexOf("="); return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]; })
);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function signUrl(bucket, filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(filename)}`,
    { method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_S }) }
  );
  if (!res.ok) return { ok: false, status: res.status, text: await res.text() };
  const data = await res.json();
  return { ok: true, url: `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}` };
}

// 1. List files in the new mp4 bucket so we know what's available.
const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(NEW_BUCKET)}`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({ limit: 500, prefix: "" }),
});
const newFiles = await listRes.json();
const availableMp4 = new Set(newFiles.filter((f) => f.name?.endsWith(".mp4")).map((f) => f.name));
console.log(`New bucket has ${availableMp4.size} .mp4 files.`);

// Helper: map any URL/path that ends with xxx.mov → xxx.mp4
// Returns null if the basename has no .mp4 counterpart.
async function mp4Counterpart(currentUrl) {
  if (!currentUrl) return null;
  const m = currentUrl.match(/\/([^\/?]+)\.mov(\?|$)/i);
  if (!m) return null;
  const slug = m[1];
  const target = `${slug}.mp4`;
  if (!availableMp4.has(target)) return null;
  const signed = await signUrl(NEW_BUCKET, target);
  if (!signed.ok) {
    console.error(`  sign failed for ${target}: ${signed.status} ${signed.text}`);
    return null;
  }
  return signed.url;
}

// 2. Update exercises table
const exercises = await (await fetch(
  `${SUPABASE_URL}/rest/v1/exercises?select=id,name,video_url&limit=2000`,
  { headers: HEADERS }
)).json();
console.log(`\nExercises rows: ${exercises.length}`);

let exoUpdated = 0, exoSkipped = 0, exoNotFound = 0;
for (const e of exercises) {
  if (!e.video_url) { exoSkipped++; continue; }
  if (/\.mp4(\?|$)/i.test(e.video_url)) { exoSkipped++; continue; } // already mp4
  const newUrl = await mp4Counterpart(e.video_url);
  if (!newUrl) {
    console.warn(`  no .mp4 found for: ${e.name}`);
    exoNotFound++;
    continue;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/exercises?id=eq.${e.id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ video_url: newUrl }),
  });
  if (r.ok) exoUpdated++;
  else console.error(`  PATCH exercise ${e.id} failed: ${r.status}`);
}
console.log(`  exercises: ${exoUpdated} updated · ${exoSkipped} skipped (no url / already mp4) · ${exoNotFound} not found in new bucket`);

// 3. Update program_items table (only active programs — i.e. not archived
// in their parent program).
const items = await (await fetch(
  `${SUPABASE_URL}/rest/v1/program_items?select=id,custom_name,video_url,week_id&video_url=like.*${OLD_BUCKET}*&limit=5000`,
  { headers: HEADERS }
)).json();
console.log(`\nProgram items still on .mov: ${items.length}`);

// Filter to only items whose parent program is not archived.
const weekIds = [...new Set(items.map((i) => i.week_id))];
let archivedWeekIds = new Set();
if (weekIds.length > 0) {
  const chunks = [];
  for (let i = 0; i < weekIds.length; i += 100) chunks.push(weekIds.slice(i, i + 100));
  for (const ch of chunks) {
    const weeks = await (await fetch(
      `${SUPABASE_URL}/rest/v1/program_weeks?select=id,program_id&id=in.(${ch.join(",")})`,
      { headers: HEADERS }
    )).json();
    const programIds = [...new Set(weeks.map((w) => w.program_id))];
    if (programIds.length === 0) continue;
    const programs = await (await fetch(
      `${SUPABASE_URL}/rest/v1/programs?select=id,is_archived&id=in.(${programIds.join(",")})`,
      { headers: HEADERS }
    )).json();
    const archivedProgIds = new Set(programs.filter((p) => p.is_archived).map((p) => p.id));
    for (const w of weeks) {
      if (archivedProgIds.has(w.program_id)) archivedWeekIds.add(w.id);
    }
  }
}

const itemsToUpdate = items.filter((it) => !archivedWeekIds.has(it.week_id));
console.log(`  active (non-archived): ${itemsToUpdate.length} (skipping ${items.length - itemsToUpdate.length} archived)`);

let itemUpdated = 0, itemNotFound = 0;
for (const it of itemsToUpdate) {
  const newUrl = await mp4Counterpart(it.video_url);
  if (!newUrl) {
    console.warn(`  no .mp4 found for: ${it.custom_name}`);
    itemNotFound++;
    continue;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/program_items?id=eq.${it.id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ video_url: newUrl }),
  });
  if (r.ok) itemUpdated++;
  else console.error(`  PATCH item ${it.id} failed: ${r.status}`);
}
console.log(`  program_items: ${itemUpdated} updated · ${itemNotFound} not found in new bucket`);

console.log(`\n✓ Done.`);
console.log(`  exercises.video_url → ${NEW_BUCKET}: ${exoUpdated}`);
console.log(`  program_items.video_url → ${NEW_BUCKET}: ${itemUpdated}`);
console.log(`\nNext: test that videos play in the app (Hamza + Max test). If OK, delete the old "videos" bucket from Supabase.`);
