// Rename every .mov in the SSD library folder to a clean slugified
// filename, in place. Skips macOS sidecar files (._foo.mov) and any
// file already in slugified form (so the script is idempotent and can
// be re-run safely).
//
// Outputs scripts/videos-mapping.json — a {original_name → slug.mov}
// map used in the next phase to seed the `exercises` table.
//
// Usage: node scripts/rename-videos-on-ssd.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const SOURCE_DIR = "/Volumes/Extreme SSD/Online video systeme";

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Source folder not found: ${SOURCE_DIR}`);
  console.error(`Make sure the SSD is plugged in.`);
  process.exit(1);
}

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // anything not alnum → hyphen
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, ""); // trim ends
}

const all = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => /\.mov$/i.test(f) && !f.startsWith(".")) // skip macOS sidecars
  .sort();

console.log(`Found ${all.length} .mov files in ${SOURCE_DIR}\n`);

// First pass: detect collisions and build the mapping. We need to
// catch duplicates BEFORE renaming so we don't accidentally clobber
// files via a slug clash.
const mapping = {};
const slugToOriginal = new Map();
const collisions = [];
for (const file of all) {
  const baseName = file.replace(/\.mov$/i, "");
  const slug = slugify(baseName) + ".mov";
  if (slugToOriginal.has(slug)) {
    collisions.push({
      slug,
      a: slugToOriginal.get(slug),
      b: baseName,
    });
  }
  slugToOriginal.set(slug, baseName);
  mapping[baseName] = slug;
}

if (collisions.length > 0) {
  console.error(
    `Found ${collisions.length} slug collision(s) — fix these before re-running:`
  );
  for (const c of collisions) {
    console.error(`  "${c.a}" and "${c.b}" both → ${c.slug}`);
  }
  process.exit(1);
}

// Second pass: rename in place. Skip files already named with their
// target slug (idempotent re-run).
let renamed = 0;
let alreadyDone = 0;
let failed = 0;

for (const file of all) {
  const baseName = file.replace(/\.mov$/i, "");
  const target = mapping[baseName];
  if (file === target) {
    alreadyDone++;
    continue;
  }
  const from = path.join(SOURCE_DIR, file);
  const to = path.join(SOURCE_DIR, target);
  try {
    fs.renameSync(from, to);
    console.log(`  ${file}  →  ${target}`);
    renamed++;
  } catch (e) {
    console.error(`  FAILED: ${file} → ${target}: ${e.message}`);
    failed++;
  }
}

const mappingPath = path.join(
  ROOT,
  "ldmove-site",
  "scripts",
  "videos-mapping.json"
);
fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

console.log(`\n=== Summary ===`);
console.log(`Renamed:        ${renamed}`);
console.log(`Already slug:   ${alreadyDone}`);
console.log(`Failed:         ${failed}`);
console.log(`Total:          ${all.length}`);
console.log(`Mapping saved:  ${mappingPath}`);
