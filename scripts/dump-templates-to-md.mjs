// Snapshot the Supabase `templates` table back to two human-readable
// markdown files under Bibliothèque/:
//   - warmup_templates.md
//   - workout_templates.md
//
// Source of truth = the database. Run this script after editing
// templates in the app so the on-disk archive stays in sync.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const BIBLIO_DIR = path.join(ROOT, "Bibliothèque");
const OUT_WARMUP = path.join(BIBLIO_DIR, "warmup_templates.md");
const OUT_WORKOUT = path.join(BIBLIO_DIR, "workout_templates.md");

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

const rows = await (await fetch(
  `${SUPABASE_URL}/rest/v1/templates?select=*&order=type.asc,name.asc`,
  { headers: HEADERS }
)).json();

const byType = { warmup: [], workout: [] };
for (const r of rows) {
  if (byType[r.type]) byType[r.type].push(r);
}

const renderTemplate = (t) => {
  let out = `## ${t.name}\n\n`;
  if (t.description) out += `${t.description}\n\n`;

  // Group consecutive exercises that share the same group_name into a
  // sub-table so SUPERSET / DROP SET blocks stay readable.
  const groups = [];
  let currentLabel = null;
  let currentRows = [];
  const flush = () => {
    if (currentRows.length === 0) return;
    groups.push({ label: currentLabel, rows: currentRows });
    currentRows = [];
  };
  for (const ex of t.exercises) {
    const gn = (ex.group_name ?? "").trim() || null;
    if (gn !== currentLabel) {
      flush();
      currentLabel = gn;
    }
    currentRows.push(ex);
  }
  flush();

  for (const g of groups) {
    if (g.label) out += `**${g.label}**\n\n`;
    out += "| Exercise | Set | Rep / Duration | Tempo | Load | Rest |\n";
    out += "|---|---|---|---|---|---|\n";
    for (const ex of g.rows) {
      const rest =
        ex.rest_seconds == null
          ? ""
          : ex.rest_seconds === 0
            ? "0"
            : `${ex.rest_seconds}s`;
      out += `| ${ex.name ?? ""} | ${ex.sets ?? ""} | ${ex.reps ?? ""} | ${
        ex.tempo ?? ""
      } | ${ex.load ?? ""} | ${rest} |\n`;
    }
    out += "\n";
  }
  return out;
};

const renderFile = (heading, list) => {
  let md = `# Ld_Move — ${heading}\n\n`;
  md += `_Dumped from Supabase \`templates\` table. Do not hand-edit — edit in the app and re-run \`scripts/dump-templates-to-md.mjs\`._\n\n`;
  md += `${list.length} template${list.length === 1 ? "" : "s"}\n\n---\n\n`;
  for (const t of list) {
    md += renderTemplate(t);
    md += "---\n\n";
  }
  return md;
};

fs.writeFileSync(OUT_WARMUP, renderFile("Warm-up templates", byType.warmup));
fs.writeFileSync(OUT_WORKOUT, renderFile("Workout templates", byType.workout));

console.log(`✓ ${OUT_WARMUP} — ${byType.warmup.length} template(s)`);
console.log(`✓ ${OUT_WORKOUT} — ${byType.workout.length} template(s)`);
