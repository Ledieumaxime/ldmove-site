// Build a single review file for the coach to validate descriptions
// across all 197 videos sitting on the SSD.
//
// Source of truth = the SSD (the actual files we'll upload to
// Supabase). For each slugified filename:
//   1. Look up the display name + category in bibliotheque.md
//   2. Look up the existing description in bibliotheque_details_draft.md
//   3. Output one row in a clean review table, grouped by category
//
// Anything on the SSD with no match in bibliotheque.md → "ORPHAN"
// section at the bottom, the coach can decide what to do (rename,
// add to biblio, drop).
//
// Output: Bibliothèque/bibliotheque-review.md

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const SSD_DIR = "/Volumes/Extreme SSD/Online video systeme";
const BIBLIO = path.join(ROOT, "Bibliothèque", "bibliotheque.md");
const DRAFT = path.join(ROOT, "Drafts", "bibliotheque_details_draft.md");
const OUT = path.join(ROOT, "Bibliothèque", "bibliotheque-review.md");

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// 1. List SSD files (slugs).
if (!fs.existsSync(SSD_DIR)) {
  console.error(`SSD not mounted: ${SSD_DIR}`);
  process.exit(1);
}
const ssdSlugs = new Set(
  fs
    .readdirSync(SSD_DIR)
    .filter((f) => /\.mov$/i.test(f) && !f.startsWith("."))
    .map((f) => f.replace(/\.mov$/i, ""))
);
console.log(`SSD: ${ssdSlugs.size} videos`);

// 2. Parse bibliotheque.md → slug → { name, face, node }
const biblio = fs.readFileSync(BIBLIO, "utf8");
const bySlug = new Map();
let face = null;
let node = null;
for (const raw of biblio.split("\n")) {
  const line = raw.trim();
  let m = line.match(/^##\s+(?:[^A-Z]*)?(FACE\s+\d+\s*—.+?)(?:\s*\(.*\))?$/i);
  if (m) {
    face = m[1].trim();
    node = null;
    continue;
  }
  m = line.match(/^###\s+(.+)$/);
  if (m) {
    node = m[1].trim();
    continue;
  }
  m = line.match(/^\|\s*([^|]+?)\s*\|\s*(https?:\/\/[^|\s]+)\s*\|/);
  if (m) {
    const name = m[1].trim();
    if (name === "Exercise" || /^[-: ]+$/.test(name)) continue;
    bySlug.set(slugify(name), { name, face, node });
  }
}
console.log(`bibliotheque.md: ${bySlug.size} entries`);

// 3. Parse bibliotheque_details_draft.md → name → { details, validated }
const draft = fs.readFileSync(DRAFT, "utf8");
const detailsByName = new Map();
for (const raw of draft.split("\n")) {
  const line = raw.trim();
  if (!line.startsWith("|")) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 3) continue;
  if (/^Exercise$/i.test(cells[0]) || /^[-: ]+$/.test(cells[0])) continue;
  const name = cells[0];
  const detailsCell = cells[2] ?? "";
  const validateCell = (cells[3] ?? "").toLowerCase();
  if (!detailsCell.trim()) continue;
  detailsByName.set(name.toLowerCase(), {
    details: detailsCell.trim(),
    validated: /^(v|✓)$/.test(validateCell),
  });
}
console.log(`details draft: ${detailsByName.size} descriptions found`);

// 4. Walk SSD, group by category, fill description if known.
const grouped = new Map(); // section → ReviewRow[]
const orphans = []; // SSD files with no match in bibliotheque.md

for (const slug of [...ssdSlugs].sort()) {
  const meta = bySlug.get(slug);
  if (!meta) {
    orphans.push(slug);
    continue;
  }
  const d = detailsByName.get(meta.name.toLowerCase());
  const sectionKey = `${meta.face} / ${meta.node}`;
  if (!grouped.has(sectionKey)) grouped.set(sectionKey, []);
  grouped.get(sectionKey).push({
    slug,
    name: meta.name,
    description: d?.details ?? "",
    validated: d?.validated ?? false,
  });
}

// 5. Anything in bibliotheque.md but missing from SSD?
const ssdSet = ssdSlugs;
const missingFromSsd = [];
for (const [slug, meta] of bySlug) {
  if (!ssdSet.has(slug)) missingFromSsd.push({ slug, name: meta.name });
}

// 6. Render the review file.
let out = "";
out += "# Bibliothèque — Review descriptions\n\n";
out += `**${ssdSlugs.size} vidéos sur le SSD** · `;
out += `**${[...grouped.values()].flat().length} matchent la biblio** · `;
out += `**${orphans.length} orphelins** · `;
out += `**${missingFromSsd.length} manquants côté SSD**\n\n`;
out += "---\n\n";
out += "## Comment valider\n\n";
out +=
  "- Lis chaque ligne. Si la description est OK → mets `V` dans la colonne ✓.\n";
out += "- Si à modifier → réécris la cellule Description.\n";
out +=
  "- Si la description est vide → écris-la (ou demande à Claude/Cowork de te la rédiger).\n";
out +=
  "- Quand toutes les lignes ont `V` → on lance le seed Supabase.\n\n";
out += "---\n\n";

const sortedSections = [...grouped.keys()].sort();
for (const section of sortedSections) {
  out += `## ${section}\n\n`;
  out += "| Exercise | File | Description | ✓ |\n";
  out += "|----------|------|-------------|---|\n";
  for (const row of grouped.get(section)) {
    const desc = (row.description || "").replace(/\|/g, "\\|");
    const tick = row.validated ? "V" : "";
    out += `| ${row.name} | \`${row.slug}.mov\` | ${desc} | ${tick} |\n`;
  }
  out += "\n";
}

if (orphans.length > 0) {
  out += "## ⚠ Orphans (sur SSD, absent de bibliotheque.md)\n\n";
  out +=
    "Ces fichiers sont sur ton SSD mais leur slug ne matche aucun nom de la biblio. À voir si tu veux les ajouter à `bibliotheque.md`, les renommer, ou les ignorer.\n\n";
  for (const slug of orphans.sort()) out += `- \`${slug}.mov\`\n`;
  out += "\n";
}

if (missingFromSsd.length > 0) {
  out += "## ⚠ Listés en biblio mais pas sur le SSD\n\n";
  out +=
    "Ces exos sont mentionnés dans `bibliotheque.md` mais aucun fichier correspondant n'a été trouvé sur le SSD. Vidéo manquante ?\n\n";
  for (const e of missingFromSsd.sort((a, b) => a.name.localeCompare(b.name)))
    out += `- ${e.name} (slug attendu : \`${e.slug}.mov\`)\n`;
  out += "\n";
}

fs.writeFileSync(OUT, out);
console.log(`\n✓ Review file generated: ${OUT}`);
console.log(`   Sections: ${sortedSections.length}`);
console.log(`   Orphans: ${orphans.length}`);
console.log(`   Missing on SSD: ${missingFromSsd.length}`);
