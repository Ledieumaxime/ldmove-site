// Build a clean canonical list of all exercises from
// bibliotheque-review.md, grouped by section, ready to be pasted into a
// Cowork prompt. The output file is the single source of truth for
// exercise names — Cowork must pick from this list verbatim.
//
// Output: Bibliothèque/exercises_canonical.md

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const REVIEW = path.join(ROOT, "Bibliothèque", "bibliotheque-review.md");
const OUT = path.join(ROOT, "Bibliothèque", "exercises_canonical.md");

const md = fs.readFileSync(REVIEW, "utf8");
const grouped = new Map(); // section → names[]
let section = null;
for (const raw of md.split("\n")) {
  const line = raw.trim();
  let m = line.match(/^##\s+(.+)$/);
  if (m && !line.startsWith("###")) {
    section = m[1].replace(/^[⚠ ]+/, "").trim();
    continue;
  }
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 2) continue;
  const name = cells[0];
  if (!name || /^Exercise$/i.test(name) || /^[-: ]+$/.test(name)) continue;
  // Accept rows with a backticked file (`xxx.mov`) OR a backticked dash
  // (`—`) for gym annex exos that have no video.
  if (!cells[1] || !cells[1].startsWith("`")) continue;
  if (!section) continue;
  if (!grouped.has(section)) grouped.set(section, []);
  grouped.get(section).push(name);
}

let out = "";
out += "# Exercises — Canonical Library\n\n";
out += "**Single source of truth.** Cowork must use these exercise names\n";
out += "**verbatim** when generating a `.md` block. Any other spelling will\n";
out += "be rejected by `scripts/import-program-from-md.mjs`.\n\n";
out += "Matching is case-insensitive but punctuation, hyphens, accents and\n";
out += "wording must match exactly. Do **not** add suffixes like `lestés`,\n";
out += "`Hold`, `Max`, `(progression)` etc. — those go in LOAD/REP/COM.\n\n";
out += `Total: ${[...grouped.values()].flat().length} exercises across ${grouped.size} sections.\n\n`;
out += "---\n\n";

const sortedSections = [...grouped.keys()].sort();
for (const s of sortedSections) {
  out += `## ${s}\n\n`;
  for (const n of grouped.get(s)) out += `- ${n}\n`;
  out += "\n";
}

fs.writeFileSync(OUT, out);
console.log(`✓ Wrote ${OUT}`);
console.log(`  Sections: ${sortedSections.length}`);
console.log(`  Exercises: ${[...grouped.values()].flat().length}`);
