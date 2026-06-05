// Convert Bibliothèque/warmup_templates.md into a typed TS module that
// the editor can import directly (no runtime fetch). Each top-level
// `## ` section becomes a template, and tables inside it become groups
// of exercises (so SUPERSET blocks materialise as group_name).

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const SRC = path.join(ROOT, "Bibliothèque", "warmup_templates.md");
const OUT = path.join(
  ROOT,
  "ldmove-site",
  "src",
  "lib",
  "warmupTemplates.ts"
);

const md = fs.readFileSync(SRC, "utf8");
const lines = md.split("\n");

const templates = [];
let currentTemplate = null;
let currentGroup = null; // string label for SUPERSET / SPINE MOBILITY / null

const slugify = (s) =>
  s
    .replace(/[^a-zA-Z0-9 ]/g, "") // drop emojis + punctuation
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 40);

for (const raw of lines) {
  const line = raw.trim();

  // Top-level section starts a new template.
  const m = line.match(/^##\s+(.+?)\s*$/);
  if (m) {
    const title = m[1].trim();
    currentTemplate = {
      id: slugify(title),
      name: title,
      exercises: [],
    };
    templates.push(currentTemplate);
    currentGroup = null;
    continue;
  }

  // Sub-label between two tables ("SUPERSET", "SPINE MOBILITY", …).
  // Always rendered as bold and on its own line.
  const bold = line.match(/^\*\*(.+?)\*\*\s*$/);
  if (bold) {
    currentGroup = bold[1].trim();
    continue;
  }

  if (!line.startsWith("|") || !currentTemplate) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());

  // Skip header / separator rows.
  if (
    cells.length < 2 ||
    /^Exercise$/i.test(cells[0]) ||
    /^[-: ]+$/.test(cells[0])
  )
    continue;

  // Columns: Exercise | Set | Rep / Duration | Tempo | Load | Rest | VIDEO | COM
  const [name, setStr, rep, tempo, load, rest] = cells;
  if (!name) continue;

  // Parse rest as seconds: handle "60", "60s", "No rest", "0", empty.
  let rest_seconds = null;
  const restClean = (rest ?? "").toLowerCase();
  if (restClean && !/no\s*rest/.test(restClean)) {
    const num = parseInt(restClean.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(num)) rest_seconds = num;
  }

  currentTemplate.exercises.push({
    name,
    sets: setStr ? parseInt(setStr, 10) || null : null,
    reps: rep || null,
    tempo: tempo || null,
    load: load || null,
    rest_seconds,
    group_name: currentGroup,
  });
}

// Emit a clean TS module.
const header = `// AUTO-GENERATED from Bibliothèque/warmup_templates.md.
// Edit the markdown then re-run scripts/build-warmup-templates.mjs.

export type WarmupTemplateExercise = {
  /** Canonical exercise name from the Supabase library. */
  name: string;
  sets: number | null;
  reps: string | null;
  tempo: string | null;
  load: string | null;
  rest_seconds: number | null;
  /** When non-null, exercises sharing the same value form a group
   *  (Superset / Drop set / Spine mobility, etc.). */
  group_name: string | null;
};

export type WarmupTemplate = {
  id: string;
  name: string;
  exercises: WarmupTemplateExercise[];
};

export const WARMUP_TEMPLATES: WarmupTemplate[] = ${JSON.stringify(templates, null, 2)};
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header);
console.log(`✓ Wrote ${OUT}`);
console.log(`  Templates: ${templates.length}`);
for (const t of templates) {
  console.log(`    · ${t.name} — ${t.exercises.length} exercise(s)`);
}
