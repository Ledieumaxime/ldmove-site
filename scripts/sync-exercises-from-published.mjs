// Sync exercises from the PUBLIÉ section of bibliotheque-review.md to
// Supabase, WITHOUT wiping the table.
//
// - For each row in PUBLIÉ + GYM ANNEX:
//   - If a row with the same name already exists → UPDATE its description
//     (and video_url if missing).
//   - If not → INSERT (with signed URL from bucket if filename is real,
//     or null for `—` gym entries).
// - Leaves untouched any exercise already in the table that isn't in
//   PUBLIÉ yet (e.g. unvalidated exos seeded for an active client).
//
// This is the script to run when you've validated more rows in the
// review file and want them live in the app.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
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
const HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function signUrl(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${filename}`,
    { method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_S }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}`;
}

// 1. Parse review — only rows in the PUBLIÉ section (after the line `# PUBLIÉ`).
const md = fs.readFileSync(REVIEW, "utf8");
const lines = md.split("\n");
let inPublished = false;
let currentSection = null;
const rows = [];
for (const raw of lines) {
  const line = raw.trim();
  if (/^#\s+PUBLIÉ(\s|$|\()/.test(line)) { inPublished = true; continue; }
  if (!inPublished) continue;
  let m = line.match(/^##\s+(.+?)\s*$/);
  if (m) { currentSection = m[1].trim(); continue; }
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (!cells[0] || /^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0])) continue;
  if (!cells[1] || !cells[1].startsWith("`")) continue;
  const name = cells[0];
  const filenameMatch = cells[1].match(/`([^`]+)`/);
  const filename = filenameMatch ? filenameMatch[1] : null;
  const description = (cells[2] || "").replace(/\\\|/g, "|").trim() || null;
  rows.push({ name, filename, description, section: currentSection });
}
console.log(`PUBLIÉ rows in review: ${rows.length}`);

// 2. Get current exercises table.
const existing = await (await fetch(
  `${SUPABASE_URL}/rest/v1/exercises?select=id,name,description,video_url&limit=1000`,
  { headers: HEADERS }
)).json();
const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
console.log(`Existing in DB: ${existing.length}`);

// 3. For each PUBLIÉ row → upsert.
let inserted = 0, updated = 0, skipped = 0;
for (const r of rows) {
  const cur = byName.get(r.name.toLowerCase());
  let video_url = null;
  if (r.filename && r.filename !== "—" && r.filename !== "-") {
    if (cur && cur.video_url) {
      video_url = cur.video_url; // keep existing signed URL (still valid)
    } else {
      video_url = await signUrl(r.filename);
    }
  }
  if (cur) {
    // UPDATE only if anything actually changes.
    const changes = {};
    if ((cur.description ?? null) !== r.description) changes.description = r.description;
    if (!cur.video_url && video_url) changes.video_url = video_url;
    if (Object.keys(changes).length === 0) { skipped++; continue; }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exercises?id=eq.${cur.id}`,
      { method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(changes) }
    );
    if (!res.ok) throw new Error(`PATCH ${cur.id}: ${res.status} ${await res.text()}`);
    updated++;
  } else {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exercises`,
      { method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ name: r.name, description: r.description, video_url, tags: r.section ? [r.section] : [] }) }
    );
    if (!res.ok) throw new Error(`INSERT ${r.name}: ${res.status} ${await res.text()}`);
    inserted++;
  }
}

console.log(`\n✓ Sync complete.`);
console.log(`  Inserted: ${inserted}`);
console.log(`  Updated:  ${updated}`);
console.log(`  Unchanged: ${skipped}`);
