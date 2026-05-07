// Import a Cowork-generated program (.md) into Supabase.
//
// The .md should follow the format documented in
// instructions_coach.md, with the new convention: NO video URLs in
// the rows — just exercise names. The script looks each name up in
// the `exercises` table to attach the right video.
//
// Usage:
//   node scripts/import-program-from-md.mjs \
//     --file path/to/program.md \
//     --client client@example.com \
//     --title "Push/Pull May" \
//     --weeks 4 \
//     [--price 0] [--billing subscription|one_time] [--no-publish]
//
// Behaviour:
//   - Parses the .md to extract days, sections (WARM UP / WORKOUT),
//     exercises with sets/reps/tempo/load/rest/notes.
//   - Validates EVERY exercise name against the `exercises` library
//     up-front. If anything is unknown, prints suggestions and exits
//     without touching the database.
//   - On success: creates 1 program + N weeks (1 per day) + items.
//   - Each item gets video_url copied from the matching exercise + a
//     fresh exercise_id link.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";

// --- CLI args ---
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, cur, i, arr) => {
      if (cur.startsWith("--")) {
        const key = cur.slice(2);
        const next = arr[i + 1];
        if (!next || next.startsWith("--")) acc.push([key, true]);
        else acc.push([key, next]);
      }
      return acc;
    }, [])
);
if (!args.file || !args.client || !args.title) {
  console.error(
    "Usage: --file <path.md> --client <email> --title <name> [--weeks N] [--price 0] [--billing subscription|one_time] [--no-publish]"
  );
  process.exit(1);
}
const FILE = args.file;
const CLIENT_EMAIL = args.client;
const TITLE = args.title;
const DURATION_WEEKS = parseInt(args.weeks ?? "4", 10);
const PRICE = parseFloat(args.price ?? "0");
const BILLING = args.billing ?? "subscription";
const PUBLISH = !args["no-publish"];

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

// --- Lookup exercises library ---
const exercisesLib = await sb(
  "GET",
  `exercises?select=id,name,video_url&limit=1000`
);
const libByName = new Map(
  exercisesLib.map((e) => [e.name.toLowerCase(), e])
);
console.log(`Library has ${exercisesLib.length} exercises.`);

// --- Parser ---
function parseProgram(md) {
  const days = []; // { title, sections: { WARMUP|WORKOUT: items[] } }
  let currentDay = null;
  let currentSection = null;
  let currentGroup = null; // tracks SUPERSET label inside a section
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    // Day header: e.g. "## DAY 1 - PUSH" or "# DAY 1 PUSH" or "PUSH - Monday"
    let m = line.match(/^#{1,3}\s+(?:DAY|SESSION|JOUR)\s*\d*[-: ]*(.+)$/i);
    if (m) {
      currentDay = { title: m[1].trim(), sections: {} };
      days.push(currentDay);
      currentSection = null;
      currentGroup = null;
      continue;
    }
    // Section header: WARM UP, WORKOUT
    m = line.match(/^#{2,4}\s*(WARM[ -]?UP|WORKOUT|COOLDOWN|MOBILITY|STRETCH)\b/i);
    if (m && currentDay) {
      const tag = m[1].toUpperCase().replace(/[\s-]/g, "");
      currentSection =
        tag === "WARMUP"
          ? "WARMUP"
          : tag === "WORKOUT"
            ? "WORKOUT"
            : tag;
      currentDay.sections[currentSection] = [];
      currentGroup = null;
      continue;
    }
    // Table row: split by | and trim
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    if (/^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0])) continue;
    if (!currentDay || !currentSection) continue;
    // Group header row: first cell wrapped in **...** (markdown bold) and
    // every other cell is empty/blank. Examples: "**SUPERSET 1**",
    // "**SET 5 — Finisher**", "**SPINE MOBILITY**". These don't represent
    // an exercise; they tag the rows that follow with a group_name.
    const firstCell = cells[0];
    const restEmpty = cells.slice(1).every((c) => !c);
    const boldMatch = firstCell.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch && restEmpty) {
      currentGroup = boldMatch[1].trim();
      continue;
    }
    // Columns: Exercise | SET | REP | TEMPO | LOAD | REST | VIDEO | COM
    // (some columns may be missing in newer outputs, so accept variable
    // length)
    const [name, set, rep, tempo, load, rest, , com] = [
      cells[0] ?? "",
      cells[1] ?? "",
      cells[2] ?? "",
      cells[3] ?? "",
      cells[4] ?? "",
      cells[5] ?? "",
      cells[6] ?? "",
      cells[7] ?? "",
    ];
    if (!name) continue;
    currentDay.sections[currentSection].push({
      name,
      sets: set ? parseInt(set, 10) || null : null,
      reps: rep || null,
      tempo: tempo || null,
      load: load || null,
      rest_seconds: rest
        ? parseInt(String(rest).replace(/[^\d]/g, ""), 10) || null
        : null,
      notes: com || null,
      group_name: currentGroup,
    });
  }
  return days;
}

// --- Suggestion helper for unknown exercise names ---
function suggest(unknown) {
  const u = unknown.toLowerCase();
  const hits = [];
  for (const known of libByName.keys()) {
    if (known.includes(u) || u.includes(known)) hits.push(known);
  }
  return hits.slice(0, 3);
}

// --- Read + parse the file ---
const md = fs.readFileSync(FILE, "utf8");
const days = parseProgram(md);
if (days.length === 0) {
  console.error(`No DAY/SESSION blocks found in ${FILE}`);
  process.exit(1);
}
console.log(`Parsed ${days.length} day(s):`);
for (const d of days) {
  const total = Object.values(d.sections)
    .map((s) => s.length)
    .reduce((a, b) => a + b, 0);
  console.log(`  · ${d.title} (${total} items)`);
}

// --- Validate every name ---
const unknowns = [];
for (const d of days) {
  for (const sec of Object.values(d.sections)) {
    for (const it of sec) {
      if (!libByName.has(it.name.toLowerCase()))
        unknowns.push({ name: it.name, day: d.title });
    }
  }
}
if (unknowns.length > 0) {
  console.error(
    `\n✗ ${unknowns.length} exercise(s) not found in the library:`
  );
  for (const u of unknowns) {
    const hints = suggest(u.name);
    const hint = hints.length ? `  did you mean: ${hints.join(", ")}?` : "";
    console.error(`  - "${u.name}" (in ${u.day})${hint}`);
  }
  console.error(
    "\nFix the .md (or add the missing exo to bibliotheque + re-seed exercises) and re-run."
  );
  process.exit(1);
}
console.log("✓ All exercise names match the library.");

// --- Find client ---
const profiles = await sb(
  "GET",
  `profiles?select=id,first_name,email&email=eq.${encodeURIComponent(CLIENT_EMAIL)}&limit=1`
);
if (profiles.length === 0) {
  console.error(`No profile for ${CLIENT_EMAIL}`);
  process.exit(1);
}
const client = profiles[0];
console.log(`Client: ${client.first_name} (${client.email})`);

// --- Build notes string from tempo/load/com ---
function buildNotes(it) {
  const parts = [];
  if (it.tempo && it.tempo !== "-") parts.push(`Tempo: ${it.tempo}`);
  if (it.load && it.load !== "-") parts.push(`Load: ${it.load}`);
  if (it.notes && it.notes !== "-") parts.push(it.notes);
  return parts.length ? parts.join(" | ") : null;
}

// --- Create program + weeks + items ---
const slug = `${slugify(TITLE)}-${Date.now().toString(36)}`;
const [program] = await sb("POST", "programs", {
  slug,
  title: TITLE,
  description: null,
  type: "custom",
  assigned_client_id: client.id,
  price_eur: PRICE,
  billing_type: BILLING,
  duration_weeks: DURATION_WEEKS,
  is_published: PUBLISH,
  is_archived: false,
});
console.log(`Program: ${program.id} (${program.slug})`);

let weekNumber = 1;
for (const day of days) {
  const [w] = await sb("POST", "program_weeks", {
    program_id: program.id,
    week_number: weekNumber,
    title: day.title,
    notes: null,
  });
  let order = 1;
  for (const [secKey, items] of Object.entries(day.sections)) {
    for (const it of items) {
      const lib = libByName.get(it.name.toLowerCase());
      await sb("POST", "program_items", {
        week_id: w.id,
        order_index: order++,
        custom_name: `[${secKey}] ${it.name}`,
        sets: it.sets,
        reps: it.reps,
        rest_seconds: it.rest_seconds,
        notes: buildNotes(it),
        video_url: lib.video_url,
        exercise_id: lib.id,
        group_name: it.group_name,
      });
    }
  }
  console.log(`  · Week ${weekNumber}: ${day.title}`);
  weekNumber++;
}

console.log(`\nDone. Program "${TITLE}" assigned to ${client.first_name}.`);
console.log(`Slug: ${program.slug}`);

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
