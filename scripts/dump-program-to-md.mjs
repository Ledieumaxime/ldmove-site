// Dump a Supabase program (one row in `programs`, N weeks, M items)
// back to a coach-readable markdown file for the on-disk archive.
//
// Usage:
//   node scripts/dump-program-to-md.mjs --id <programUuid> --out <path>
//
// Output format mirrors the Cowork-style blocs we already keep under
// Clients/<name>/: header with title/level/duration/split, then one
// `## SESSION N — TITLE` per program_weeks row, with `### WARM UP`
// + `### WORKOUT` sub-sections that hold the standard 8-column table.
// Supersets and drop sets get a bold-only row above their members so
// the same parser that imports Cowork blocs would pick them up.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";

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
if (!args.id || !args.out) {
  console.error("Usage: --id <programUuid> --out <path>");
  process.exit(1);
}

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

const [program] = await (await fetch(
  `${SUPABASE_URL}/rest/v1/programs?select=*&id=eq.${args.id}&limit=1`,
  { headers: HEADERS }
)).json();
if (!program) {
  console.error(`Program ${args.id} not found.`);
  process.exit(1);
}
const weeks = await (await fetch(
  `${SUPABASE_URL}/rest/v1/program_weeks?select=*&program_id=eq.${args.id}&order=week_number.asc`,
  { headers: HEADERS }
)).json();
const items = await (await fetch(
  `${SUPABASE_URL}/rest/v1/program_items?select=*&week_id=in.(${weeks
    .map((w) => w.id)
    .join(",")})&order=order_index.asc&limit=5000`,
  { headers: HEADERS }
)).json();

console.log(
  `Program: ${program.title} · ${weeks.length} session(s) · ${items.length} item(s)`
);

const sectionOf = (custom_name) => {
  if (!custom_name) return "WORKOUT";
  const m = custom_name.match(/^\[([^\]]+)\]/);
  return m && /WARM/i.test(m[1]) ? "WARMUP" : "WORKOUT";
};

const stripPrefix = (s) => (s ? s.replace(/^\[[^\]]+\]\s*/, "") : "");

const parseNotes = (raw) => {
  if (!raw) return { tempo: "", load: "", com: "" };
  const parts = raw.split("|").map((p) => p.trim());
  let tempo = "";
  let load = "";
  const others = [];
  for (const p of parts) {
    const t = p.match(/^Tempo:\s*(.+)$/i);
    const l = p.match(/^Load:\s*(.+)$/i);
    if (t) tempo = t[1];
    else if (l) load = l[1];
    else if (p) others.push(p);
  }
  return { tempo, load, com: others.join(" · ") };
};

const escCell = (s) => (s ?? "").toString().replace(/\|/g, "\\|");

let out = `# ${program.title.toUpperCase()}\n\n`;
out += `**Duration:** ${program.duration_weeks ?? "?"} week${
  program.duration_weeks === 1 ? "" : "s"
}\n`;
if (program.description) out += `**Description:** ${program.description}\n`;
out += `\n---\n\n`;

for (let i = 0; i < weeks.length; i++) {
  const w = weeks[i];
  const wItems = items
    .filter((it) => it.week_id === w.id)
    .sort((a, b) => a.order_index - b.order_index);

  out += `## SESSION ${i + 1} — ${w.title || `Session ${i + 1}`}\n\n`;

  for (const section of ["WARMUP", "WORKOUT"]) {
    const secItems = wItems.filter((it) => sectionOf(it.custom_name) === section);
    if (secItems.length === 0) continue;

    out += `### ${section === "WARMUP" ? "WARM UP" : "WORKOUT"}\n\n`;
    out += `| Exercise | SET | REP | TEMPO | LOAD | REST | VIDEO | COM |\n`;
    out += `|---|---|---|---|---|---|---|---|\n`;

    let currentGroup = null;
    for (const it of secItems) {
      const gn = it.group_name?.trim() || null;
      if (gn && gn !== currentGroup) {
        out += `| **${gn.toUpperCase()}** | | | | | | | |\n`;
        currentGroup = gn;
      }
      if (!gn) currentGroup = null;
      const { tempo, load, com } = parseNotes(it.notes);
      const name = stripPrefix(it.custom_name) || "—";
      const rest =
        it.rest_seconds == null
          ? ""
          : it.rest_seconds === 0
            ? "0"
            : `${it.rest_seconds}`;
      out += `| ${escCell(name)} | ${escCell(it.sets ?? "")} | ${escCell(
        it.reps ?? ""
      )} | ${escCell(tempo)} | ${escCell(load)} | ${escCell(rest)} |  | ${escCell(
        com
      )} |\n`;
    }
    out += `\n`;
  }
  out += `---\n\n`;
}

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, out);
console.log(`✓ Wrote ${args.out}`);
