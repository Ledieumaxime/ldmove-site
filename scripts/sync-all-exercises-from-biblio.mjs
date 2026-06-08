// Push every exercise listed in Bibliothèque/bibliotheque-review.md
// to the Supabase `exercises` table — validated or not. Descriptions
// are only filled for rows currently in the PUBLIÉ section. Anything
// in À RÉDIGER / À VALIDER gets inserted with description=null so the
// program editor can still pick it. As the coach validates more rows,
// re-running the script tops up descriptions in place.
//
// Why bother? The program creator UI lets the coach attach any
// canonical exercise. Filtering to validated-only meant the picker
// hid ~68 exercises that have a video and a name but no description
// yet, which the coach can perfectly well prescribe in the meantime.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const REVIEW = path.join(ROOT, "Bibliothèque", "bibliotheque-review.md");
const NEW_BUCKET = "Videos Mp4";
const SIGNED_URL_EXPIRY_S = 365 * 24 * 60 * 60;

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

async function signUrl(filename) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(
      NEW_BUCKET
    )}/${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_S }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL ?? data.signedUrl}`;
}

// --- Parse the review file in two passes: published, and everything
//     else. Everything else still ships with the (possibly empty)
//     description column from the file.

const md = fs.readFileSync(REVIEW, "utf8");
const lines = md.split("\n");
const rows = [];
let inPublished = false;
let currentSection = null;

for (const raw of lines) {
  const line = raw.trim();
  if (/^#\s+PUBLIÉ(\s|$|\()/.test(line)) {
    inPublished = true;
    continue;
  }
  let m = line.match(/^##\s+(.+?)\s*$/);
  if (m) {
    currentSection = m[1].trim();
    continue;
  }
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (!cells[0] || /^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0]))
    continue;
  if (!cells[1] || !cells[1].startsWith("`")) continue;
  const fnMatch = cells[1].match(/`([^`]+)`/);
  if (!fnMatch) continue;
  const filename = fnMatch[1];
  const desc = (cells[2] || "").replace(/\\\|/g, "|").trim();
  const v2 = (cells[4] || "").replace(/\\\|/g, "|").trim();
  // Prefer the validated description (column 3) if non-empty;
  // otherwise fall back to v2 (Claude's suggestion).
  const description = desc || v2 || null;
  rows.push({
    name: cells[0],
    filename,
    description,
    section: currentSection,
    published: inPublished,
  });
}
console.log(`Parsed ${rows.length} row(s) from review file.`);

// Some names appear twice if À RÉDIGER and PUBLIÉ contain the same
// canonical name (shouldn't happen, but be defensive).
const dedup = new Map();
for (const r of rows) {
  const key = r.name.toLowerCase();
  // Published takes precedence so we keep the validated description.
  if (!dedup.has(key) || (r.published && !dedup.get(key).published)) {
    dedup.set(key, r);
  }
}
const unique = [...dedup.values()];
console.log(`Unique exercises: ${unique.length}`);

// --- Existing rows in DB ---
const existing = await (await fetch(
  `${SUPABASE_URL}/rest/v1/exercises?select=id,name,description,video_url&limit=2000`,
  { headers: HEADERS }
)).json();
const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
console.log(`In DB: ${existing.length}`);

let inserted = 0;
let updated = 0;
let skipped = 0;

for (const r of unique) {
  const cur = byName.get(r.name.toLowerCase());

  // Resolve video URL — for entries with a real `.mov`-named file we
  // map to the `.mp4` counterpart in the Videos Mp4 bucket. Entries
  // tagged with `—` (GYM ANNEX) keep video_url = null.
  let video_url = cur?.video_url ?? null;
  if (!video_url && r.filename && r.filename !== "—" && r.filename !== "-") {
    const mp4 = r.filename.replace(/\.mov$/i, ".mp4");
    video_url = await signUrl(mp4);
  }

  if (cur) {
    const changes = {};
    if ((cur.description ?? null) !== r.description) {
      changes.description = r.description;
    }
    if (!cur.video_url && video_url) changes.video_url = video_url;
    if (Object.keys(changes).length === 0) {
      skipped++;
      continue;
    }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exercises?id=eq.${cur.id}`,
      {
        method: "PATCH",
        headers: {
          ...HEADERS,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(changes),
      }
    );
    if (!res.ok) {
      console.error(`PATCH ${cur.id} failed: ${res.status} ${await res.text()}`);
      continue;
    }
    updated++;
  } else {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/exercises`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name: r.name,
        description: r.description,
        video_url,
        tags: r.section ? [r.section] : [],
      }),
    });
    if (!res.ok) {
      console.error(`INSERT ${r.name} failed: ${res.status} ${await res.text()}`);
      continue;
    }
    inserted++;
  }
}

console.log(`\n✓ Sync complete.`);
console.log(`  Inserted: ${inserted}`);
console.log(`  Updated:  ${updated}`);
console.log(`  Unchanged: ${skipped}`);
