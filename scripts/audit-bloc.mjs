// Standalone audit for a Cowork-generated bloc .md.
// Use this BEFORE handing the bloc to import-program-from-md.mjs to
// catch naming mismatches early.
//
// Usage:
//   node scripts/audit-bloc.mjs --file path/to/bloc.md
//
// Reports:
//   - Exercises that don't match the canonical biblio (with suggestions)
//   - Rows with empty REP (likely Cowork forgot a value)
//   - Rows with French words in COM (instructions_coach.md says English)
//   - Suspect LOAD values (e.g. band on a "Ring assisted" exo)
//
// Exit code 1 if any blocking issue found.

import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const key = cur.slice(2);
      const next = arr[i + 1];
      if (!next || next.startsWith("--")) acc.push([key, true]);
      else acc.push([key, next]);
    }
    return acc;
  }, [])
);
if (!args.file) {
  console.error("Usage: --file <path.md>");
  process.exit(1);
}

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const REVIEW = `${ROOT}/Bibliothèque/bibliotheque-review.md`;

// Load canonical names from the review file (single source of truth).
const reviewMd = fs.readFileSync(REVIEW, "utf8");
const canonicalByLower = new Map();
for (const raw of reviewMd.split("\n")) {
  if (!raw.startsWith("| ")) continue;
  const cells = raw.split("|").slice(1, -1).map((c) => c.trim());
  if (!cells[0] || /^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0])) continue;
  // Accept rows with a backticked file (`xxx.mov`) OR a backticked dash
  // (`—`) for gym annex exos that have no video.
  if (!cells[1] || !cells[1].startsWith("`")) continue;
  canonicalByLower.set(cells[0].toLowerCase(), cells[0]);
}

function fuzzy(name) {
  const lc = name.toLowerCase();
  const hits = [];
  for (const known of canonicalByLower.keys()) {
    if (known.includes(lc) || lc.includes(known)) {
      hits.push({ score: Math.abs(known.length - lc.length), known: canonicalByLower.get(known) });
      continue;
    }
    const a = new Set(lc.split(/\W+/).filter(Boolean));
    const b = new Set(known.split(/\W+/).filter(Boolean));
    const inter = [...a].filter((w) => b.has(w)).length;
    if (inter >= 2) hits.push({ score: 100 - inter, known: canonicalByLower.get(known) });
  }
  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, 3).map((h) => h.known);
}

const FRENCH_HINTS = /\b(les?|du|des|la|une?|sur|avec|pour|jambes?|bras|haut|bas|tete|tête|dos|épaule|épaules|hanche|hanches|chaise|romaine|squat|élévation|élévations|ischio|cheville|chevilles|haltères?|barre)\b/i;

const md = fs.readFileSync(args.file, "utf8");
const lines = md.split("\n");

const issues = { unknownNames: [], frenchNotes: [], emptyReps: [], oddLoads: [] };
let currentSession = null;
let currentSection = null;
let currentGroup = null;

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.trim();
  let m = line.match(/^#{1,3}\s+(?:DAY|SESSION|JOUR)\s*\d*[-: ]*(.+)$/i);
  if (m) { currentSession = m[1].trim(); currentSection = null; currentGroup = null; continue; }
  m = line.match(/^#{2,4}\s*(WARM[ -]?UP|WORKOUT|COOLDOWN|MOBILITY|STRETCH)\b/i);
  if (m) { currentSection = m[1].toUpperCase().replace(/[\s-]/g, ""); currentGroup = null; continue; }
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 2) continue;
  if (/^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0])) continue;
  const restEmpty = cells.slice(1).every((c) => !c);
  const bold = cells[0].match(/^\*\*(.+?)\*\*$/);
  if (bold && restEmpty) { currentGroup = bold[1].trim(); continue; }
  const name = cells[0];
  if (!name) continue;
  const where = `L${i + 1} (${currentSession ?? "?"} / ${currentSection ?? "?"}${currentGroup ? " / " + currentGroup : ""})`;
  // Unknown name?
  if (!canonicalByLower.has(name.toLowerCase())) {
    issues.unknownNames.push({ name, where, sug: fuzzy(name) });
  }
  // Empty REP?
  const rep = cells[2] ?? "";
  if (!rep) issues.emptyReps.push({ name, where });
  // Odd LOAD: "Ring assisted" with a band?
  const load = cells[4] ?? "";
  if (/Ring assisted/i.test(name) && /band/i.test(load)) {
    issues.oddLoads.push({ name, where, load, hint: "Ring assisted = no band, the rings provide assistance. Use BW." });
  }
  // French words in COM?
  const com = cells[7] ?? "";
  if (com && FRENCH_HINTS.test(com)) {
    issues.frenchNotes.push({ name, where, com });
  }
}

let blocking = 0;
console.log(`Audit: ${args.file}\n`);
if (issues.unknownNames.length) {
  console.log(`✗ ${issues.unknownNames.length} unknown exercise name(s):`);
  for (const u of issues.unknownNames) {
    const sug = u.sug.length ? `   ↪ maybe: ${u.sug.join(" | ")}` : "";
    console.log(`  - "${u.name}" — ${u.where}\n${sug}`);
  }
  blocking += issues.unknownNames.length;
  console.log("");
}
if (issues.emptyReps.length) {
  console.log(`⚠ ${issues.emptyReps.length} row(s) with empty REP:`);
  for (const e of issues.emptyReps) console.log(`  - ${e.name} (${e.where})`);
  console.log("");
}
if (issues.oddLoads.length) {
  console.log(`⚠ ${issues.oddLoads.length} row(s) with suspect LOAD:`);
  for (const e of issues.oddLoads) console.log(`  - ${e.name} (${e.where}): LOAD="${e.load}" — ${e.hint}`);
  console.log("");
}
if (issues.frenchNotes.length) {
  console.log(`⚠ ${issues.frenchNotes.length} note(s) likely in French (instructions_coach.md says English):`);
  for (const e of issues.frenchNotes) console.log(`  - ${e.name} (${e.where}): "${e.com}"`);
  console.log("");
}
if (blocking === 0 && issues.emptyReps.length === 0 && issues.oddLoads.length === 0 && issues.frenchNotes.length === 0) {
  console.log("✓ No issues. Bloc is import-ready.");
  process.exit(0);
}
if (blocking > 0) {
  console.log(`\n${blocking} blocking issue(s). Fix the .md and re-run.`);
  process.exit(1);
}
console.log(`\nNon-blocking warnings only. You can import, but review them first.`);
process.exit(0);
