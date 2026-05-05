// Import a Cowork-generated program markdown into Supabase.
//
// What the .md must look like (matches what Cowork outputs today):
//
//   # Title
//   ## Block Information
//   - **Period**: …
//   …
//   ## SESSION 1 — PUSH / LEG
//   ### Warm up
//   | Exercise | SET | REP | TEMPO | LOAD | REST | VIDEO | COM |
//   | --- | --- | --- | --- | --- | --- | --- | --- |
//   | Banded shoulder dislocation | 1 | 1 min |  | Small band | 0 | … |  |
//   …
//   ### Workout
//   | Exercise | SET | REP | TEMPO | LOAD | REST | VIDEO | COM |
//   …
//   | **SUPERSET 1** | | … |     ← bold marker, no real exercise data
//   | Dips | 3 | 6 | 3/3s/1/1 | 30kg | 0 | | Objectif … |
//   | Wild Jefferson Curl |   | 8 | 3/5s/1/1 | 20kg | 90s | … | |
//
// The script:
//   - parses every SESSION block into one program_week
//   - splits into Warm up / Workout subsections
//   - looks up each exercise by name in the exercises library
//     (must have been seeded first via seed-exercises-from-md.mjs)
//   - derives sets/reps/tempo/load/rest from the table cells
//   - groups SUPERSET rows under the same group_name
//   - sets video_url from the library, ignoring the .md VIDEO cell
//     (Cowork can stop pasting Drive URLs)
//   - [WARMUP] / [WORKOUT] section prefix in custom_name so the app
//     renders the right colour banner
//
// Unknown exercise name → loud error, the import aborts before any
// row is created. The coach fixes the name in the .md OR adds the
// exercise to bibliotheque.md, then re-seeds.
//
// Usage:
//   node scripts/import-program-cowork.mjs \
//        --md "/Users/.../Clients/Pratik/pratik_bloc_2_april.md" \
//        --client-email pratik@example.com \
//        --title "Pratik — Bloc 2: April" \
//        --duration-weeks 4

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";

// --- CLI args ---
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const MD_PATH = args.md;
const CLIENT_EMAIL = args["client-email"];
const PROGRAM_TITLE = args.title;
const DURATION_WEEKS = parseInt(args["duration-weeks"] || "4", 10);
if (!MD_PATH || !CLIENT_EMAIL || !PROGRAM_TITLE) {
  console.error(
    "Usage: --md <path> --client-email <email> --title <title> [--duration-weeks <n>]"
  );
  process.exit(1);
}

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

// --- Parse markdown ---
// Keeps things deliberately simple: state machine that walks the
// lines and flushes rows once the table runs out.
function parseMd(md) {
  const sessions = [];
  let session = null;
  let subsection = null; // "warmup" | "workout"
  let inTable = false;
  let groupName = null; // current SUPERSET name

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    // Session header: "## SESSION 1 — PUSH / LEG"
    let m = line.match(/^##\s+SESSION\s+(\d+)\s*—\s*(.+)$/i);
    if (m) {
      session = {
        week_number: parseInt(m[1], 10),
        title: m[2].trim(),
        warmup: [],
        workout: [],
      };
      sessions.push(session);
      subsection = null;
      groupName = null;
      inTable = false;
      continue;
    }
    if (!session) continue;
    // Subsection header: "### Warm up" / "### Workout"
    m = line.match(/^###\s+(.+)$/);
    if (m) {
      const t = m[1].toLowerCase();
      if (t.includes("warm")) subsection = "warmup";
      else if (t.includes("workout")) subsection = "workout";
      else subsection = null;
      groupName = null;
      inTable = false;
      continue;
    }
    if (!subsection) continue;
    // Table row?
    if (line.startsWith("|")) {
      // Separator row: "|---|---|" → skip, mark we're in the table
      if (/^\|[\s|:-]+\|$/.test(line)) {
        inTable = true;
        continue;
      }
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length === 0) continue;
      // Header row
      if (/^Exercise$/i.test(cells[0]) || cells[0] === "") {
        // Cells[0] empty + bold marker only → check for SUPERSET
        if (cells[0] === "" && cells.every((c) => c === "")) continue;
        if (/^Exercise$/i.test(cells[0])) {
          inTable = true;
          continue;
        }
      }
      // SUPERSET marker: "| **SUPERSET 1** | | | ... |"
      m = cells[0].match(/^\*\*\s*(SUPERSET[^*]+)\*\*$/i);
      if (m) {
        groupName = m[1].trim();
        continue;
      }
      // Strip bold markers / emphasis from name
      const cleanName = cells[0]
        .replace(/^\*\*|\*\*$/g, "")
        .replace(/^_+|_+$/g, "")
        .trim();
      if (!cleanName) continue;
      // Build the row (8 columns expected: Exercise / SET / REP /
      // TEMPO / LOAD / REST / VIDEO / COM). Missing trailing cells
      // are tolerated.
      const [, sets, reps, tempo, load, rest, , com] = cells;
      const item = {
        name: cleanName,
        sets: parseSets(sets),
        reps: cleanCell(reps),
        tempo: cleanCell(tempo),
        load: cleanCell(load),
        rest_seconds: parseRest(rest),
        coach_note: cleanCell(com),
        group_name: groupName,
      };
      if (subsection === "warmup") session.warmup.push(item);
      else session.workout.push(item);
    } else if (inTable) {
      // Empty line right after a table → table ended
      inTable = false;
      groupName = null;
    }
  }
  return sessions;
}

function cleanCell(s) {
  if (!s) return null;
  const v = s.trim();
  return v === "" ? null : v;
}
function parseSets(s) {
  const v = cleanCell(s);
  if (!v) return null;
  const n = parseInt(v.match(/\d+/)?.[0] ?? "", 10);
  return Number.isFinite(n) ? n : null;
}
function parseRest(s) {
  const v = cleanCell(s);
  if (!v) return null;
  // "60s" / "60" / "90s" / "0" / "1m" / "1 min"
  if (/^0$/i.test(v)) return 0;
  const sec = v.match(/^(\d+)\s*s/i);
  if (sec) return parseInt(sec[1], 10);
  const min = v.match(/^(\d+)\s*m(in)?/i);
  if (min) return parseInt(min[1], 10) * 60;
  const num = parseInt(v.match(/\d+/)?.[0] ?? "", 10);
  return Number.isFinite(num) ? num : null;
}

// --- Resolve exercises against the library ---
async function buildExerciseLookup() {
  const rows = await sb("GET", "exercises?select=id,name,video_url");
  const byName = new Map();
  for (const r of rows) byName.set(r.name.toLowerCase(), r);
  return byName;
}

// --- Main ---
const md = fs.readFileSync(MD_PATH, "utf8");
const sessions = parseMd(md);
console.log(`Parsed ${sessions.length} sessions:`);
for (const s of sessions) {
  console.log(
    `  Session ${s.week_number} "${s.title}" — warmup ${s.warmup.length}, workout ${s.workout.length}`
  );
}

const lookup = await buildExerciseLookup();
console.log(`\nLibrary: ${lookup.size} exercises available.`);

// Validate all names BEFORE creating anything.
const unknown = [];
for (const s of sessions) {
  for (const it of [...s.warmup, ...s.workout]) {
    if (!lookup.has(it.name.toLowerCase())) unknown.push(it.name);
  }
}
if (unknown.length > 0) {
  console.error(
    `\n✗ ${unknown.length} unknown exercise name(s). Add them to bibliotheque.md (and re-seed) or fix the .md:`
  );
  for (const n of new Set(unknown)) console.error(`   - ${n}`);
  process.exit(1);
}

// Find target client.
const profiles = await sb(
  "GET",
  `profiles?select=id,first_name,email&email=eq.${encodeURIComponent(CLIENT_EMAIL)}&limit=1`
);
if (profiles.length === 0) {
  console.error(`\n✗ No profile for ${CLIENT_EMAIL}`);
  process.exit(1);
}
const client = profiles[0];

const slug = `${slugifyTitle(PROGRAM_TITLE)}-${Date.now().toString(36)}`;
const [program] = await sb("POST", "programs", {
  slug,
  title: PROGRAM_TITLE,
  description: null,
  type: "custom",
  assigned_client_id: client.id,
  price_eur: 0,
  billing_type: "subscription",
  duration_weeks: DURATION_WEEKS,
  is_published: true,
  is_archived: false,
});
console.log(`\nCreated program ${program.id} (${program.slug})`);

for (const s of sessions) {
  const [w] = await sb("POST", "program_weeks", {
    program_id: program.id,
    week_number: s.week_number,
    title: s.title,
  });
  let order = 1;
  const all = [
    ...s.warmup.map((it) => ({ it, section: "WARMUP" })),
    ...s.workout.map((it) => ({ it, section: "WORKOUT" })),
  ];
  for (const { it, section } of all) {
    const ex = lookup.get(it.name.toLowerCase());
    const notesParts = [];
    if (it.tempo) notesParts.push(`Tempo: ${it.tempo}`);
    if (it.load) notesParts.push(`Load: ${it.load}`);
    if (it.coach_note) notesParts.push(it.coach_note);
    const notes = notesParts.join(" | ") || null;
    await sb("POST", "program_items", {
      week_id: w.id,
      order_index: order++,
      exercise_id: ex.id,
      custom_name: `[${section}] ${it.name}`,
      sets: it.sets,
      reps: it.reps,
      rest_seconds: it.rest_seconds,
      notes,
      video_url: ex.video_url,
      group_name: it.group_name,
    });
  }
  console.log(
    `  Session ${s.week_number}: ${all.length} items pushed`
  );
}

console.log(`\n✓ Import complete.`);
console.log(`Open: /app/programs/${program.slug}`);

function slugifyTitle(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
