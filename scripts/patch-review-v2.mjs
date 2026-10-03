// Fill the "Description v2 (Claude)" column of Bibliothèque/bibliotheque-review.md.
//
// Usage:
//   node scripts/patch-review-v2.mjs --in drafts.json [--dry]
//
// drafts.json is { "<Exercise name>": "<draft description>", ... }
//
// What it will not do, by construction:
//   - touch the ✓ column. That column is the only thing that publishes a
//     description, and it is Maxime's alone. See the long note in
//     sync-all-exercises-from-biblio.mjs about the day a script decided
//     for him.
//   - touch the Description column, which holds his own wording.
//   - touch a row already marked V, published or not.
//   - touch the "À VALIDER" table, whose fifth column is Section, not v2.
//     Writing a draft there would overwrite the section name.
//
// So the worst case is a bad draft sitting in a column he reads before
// deciding, which is what the column is for.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const REVIEW = path.join(ROOT, "Bibliothèque", "bibliotheque-review.md");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const next = arr[i + 1];
      acc.push([cur.slice(2), !next || next.startsWith("--") ? true : next]);
    }
    return acc;
  }, [])
);
if (!args.in) {
  console.error("Usage: --in drafts.json [--dry]");
  process.exit(1);
}
const drafts = JSON.parse(fs.readFileSync(args.in, "utf8"));
const DRY = Boolean(args.dry);

const lines = fs.readFileSync(REVIEW, "utf8").split("\n");

/** Which table are we in? The fifth column means different things in
 *  each, so the section decides whether a row is writable at all. */
let table = null; // "a-valider" | "a-rediger" | "publie"
let published = false;

const applied = [];
const skipped = [];
const unseen = new Set(Object.keys(drafts));

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const t = line.trim();

  if (/^#\s+PUBLIÉ(\s|$|\()/.test(t)) {
    published = true;
    table = "publie";
    continue;
  }
  const h = t.match(/^##\s+(.+?)\s*$/);
  if (h) {
    const title = h[1].toUpperCase();
    if (!published) {
      if (title.startsWith("À VALIDER")) table = "a-valider";
      else if (title.startsWith("À RÉDIGER")) table = "a-rediger";
      else table = null;
    }
    continue;
  }
  if (!t.startsWith("|")) continue;

  // Split on the raw line so we can rebuild it with the original spacing
  // of the untouched cells.
  const parts = line.split("|");
  if (parts.length < 7) continue; // needs 5 cells plus the two edges
  const cells = parts.slice(1, -1);
  const name = cells[0].trim();
  if (!name || /^Exercise$/i.test(name) || /^[-: ]+$/.test(name)) continue;
  if (!cells[1].trim().startsWith("`")) continue;

  const draft = drafts[name];
  if (draft === undefined) continue;
  unseen.delete(name);

  const tick = (cells[3] ?? "").trim().toUpperCase();
  if (tick === "V") {
    skipped.push(`${name} (déjà validé V)`);
    continue;
  }
  if (table !== "a-rediger") {
    skipped.push(`${name} (hors table À RÉDIGER, 5e colonne = ${table})`);
    continue;
  }

  // A pipe inside a cell has to stay escaped or the row grows a column.
  cells[4] = ` ${draft.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()} `;
  lines[i] = `|${cells.join("|")}|`;
  applied.push(name);
}

console.log(`appliqués : ${applied.length}`);
for (const n of applied) console.log(`  + ${n}`);
if (skipped.length) {
  console.log(`\nignorés : ${skipped.length}`);
  for (const n of skipped) console.log(`  - ${n}`);
}
if (unseen.size) {
  console.log(`\nnoms introuvables dans le fichier : ${unseen.size}`);
  for (const n of unseen) console.log(`  ? ${n}`);
}

if (DRY) {
  console.log("\n--dry : rien écrit");
} else {
  fs.writeFileSync(REVIEW, lines.join("\n"));
  console.log(`\n✓ ${REVIEW}`);
}
