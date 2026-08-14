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

// What the client ACTUALLY did, plus the coach/client threads. Both tables
// key off program_items.id, so they only exist while the program does
// (`on delete cascade`). Dumping them here makes the block file the whole
// archive instead of just the prescription: re-run this script when
// archiving a block and the logged sets land next to what was asked.
const itemIds = items.map((it) => it.id);

/** Chunked in.() so a long id list never blows the URL length, and paged
 *  because PostgREST silently caps responses at 1000 rows. */
async function fetchByItems(table, column, select, order) {
  const out = [];
  for (let i = 0; i < itemIds.length; i += 80) {
    const chunk = itemIds.slice(i, i + 80).join(",");
    let from = 0;
    for (;;) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}` +
          `?select=${select}&${column}=in.(${chunk})&order=${order}`,
        { headers: { ...HEADERS, Range: `${from}-${from + 999}` } }
      );
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
      out.push(...rows);
      if (rows.length < 1000) break;
      from += 1000;
    }
  }
  return out;
}

const logs = itemIds.length
  ? await fetchByItems(
      "workout_logs",
      "program_item_id",
      "program_item_id,session_date,set_number,reps_done,weight_kg",
      "session_date.asc,set_number.asc"
    )
  : [];
const comments = itemIds.length
  ? await fetchByItems(
      "exercise_comments",
      "item_id",
      "item_id,author_role,body,created_at",
      "created_at.asc"
    )
  : [];

console.log(
  `Program: ${program.title} · ${weeks.length} session(s) · ${items.length} item(s)` +
    ` · ${logs.length} logged set(s) · ${comments.length} comment(s)`
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

/** Mirrors detectTracking() in src/components/ProgramItemCard.tsx: the
 *  logger stores a bare number, the prescription tells us its unit. */
const unitSuffix = (reps) => {
  const r = (reps ?? "").toLowerCase().trim();
  if (/^max\s*(hold|sec|second)/i.test(r)) return "s";
  if (/^\s*\d+(\.\d+)?\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i.test(r))
    return "s";
  return "";
};

// item id -> { "YYYY-MM-DD": [log, ...] }. One date is one run of the
// session; a block loops, so the same item holds several runs.
const runsByItem = new Map();
for (const l of logs) {
  if (!runsByItem.has(l.program_item_id)) runsByItem.set(l.program_item_id, new Map());
  const byDate = runsByItem.get(l.program_item_id);
  if (!byDate.has(l.session_date)) byDate.set(l.session_date, []);
  byDate.get(l.session_date).push(l);
}

const commentsByItem = new Map();
for (const c of comments) {
  if (!commentsByItem.has(c.item_id)) commentsByItem.set(c.item_id, []);
  commentsByItem.get(c.item_id).push(c);
}

/** Renders what actually happened for one session: the sets the client
 *  logged (per date, against the prescription) and the coach/client
 *  thread. Returns "" when the session has neither, so a freshly
 *  published block dumps exactly as it did before this existed. */
function renderHistory(wItems, headingLevel = 3) {
  const h = "#".repeat(headingLevel);
  let s = "";

  const logged = wItems.filter((it) => runsByItem.has(it.id));
  if (logged.length) {
    s += `${h} LOGGED\n\n`;
    for (const it of logged) {
      const presc = it.sets ? `${it.sets} x ${it.reps ?? "?"}` : it.reps ?? "?";
      s += `**${stripPrefix(it.custom_name)}** (prescribed ${presc})\n`;
      const byDate = runsByItem.get(it.id);
      for (const date of [...byDate.keys()].sort()) {
        const sets = byDate
          .get(date)
          .sort((a, b) => a.set_number - b.set_number)
          .map((x) => {
            const v =
              x.reps_done == null ? "?" : `${x.reps_done}${unitSuffix(it.reps)}`;
            return x.weight_kg ? `${v} @ ${x.weight_kg}kg` : v;
          });
        s += `- ${date} : ${sets.join(", ")}\n`;
      }
      s += `\n`;
    }
  }

  const threaded = wItems.filter((it) => commentsByItem.has(it.id));
  if (threaded.length) {
    s += `${h} COMMENTS\n\n`;
    const flat = threaded
      .flatMap((it) =>
        commentsByItem
          .get(it.id)
          .map((c) => ({ ...c, exercise: stripPrefix(it.custom_name) }))
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const c of flat) {
      const body = c.body.replace(/\s*\n+\s*/g, " ").trim();
      s += `- **[${c.author_role}]** ${c.created_at.slice(0, 10)} · ${
        c.exercise
      }\n  ${body}\n`;
    }
    s += `\n`;
  }
  return s;
}

const itemsOfWeek = (w) =>
  items.filter((it) => it.week_id === w.id).sort((a, b) => a.order_index - b.order_index);

/** Some week titles are stored already prefixed ("— PUSH"), which would
 *  render as "SESSION 1 — — PUSH" under our own separator. */
const weekTitle = (w, i) =>
  (w.title || "").replace(/^[\s—–-]+/, "").trim() || `Session ${i + 1}`;

// --history-only: leave an existing file completely alone and just refresh
// its history block. Required for blocs that were hand-written first and
// imported after: regenerating them from Supabase silently drops details
// the database never captured (a REST of "0", a "30s" rest, spacing), so
// the markdown on disk is more faithful than the DB for those columns.
const MARK_START = "<!-- TRAINING-HISTORY:START -->";
const MARK_END = "<!-- TRAINING-HISTORY:END -->";

if (args["history-only"]) {
  if (!fs.existsSync(args.out)) {
    console.error(
      `--history-only needs an existing file, and ${args.out} is missing.\n` +
        `Dump it normally first (without the flag).`
    );
    process.exit(1);
  }
  const existing = fs.readFileSync(args.out, "utf8");

  let block = `${MARK_START}\n\n## TRAINING HISTORY\n\n`;
  block += `> Logged sets and coach/client threads for this block, pulled from\n`;
  block += `> Supabase on ${new Date().toISOString().slice(0, 10)}. The prescription\n`;
  block += `> above is untouched. Re-run to refresh:\n`;
  block += `> \`dump-program-to-md.mjs --id ${args.id} --out <this file> --history-only\`\n\n`;
  let any = false;
  for (let i = 0; i < weeks.length; i++) {
    const h = renderHistory(itemsOfWeek(weeks[i]), 4);
    if (!h) continue;
    any = true;
    block += `### SESSION ${i + 1} — ${weekTitle(weeks[i], i)}\n\n${h}`;
  }
  block += `${MARK_END}\n`;

  if (!any) {
    console.log(`Nothing logged on "${program.title}", file left untouched.`);
    process.exit(0);
  }

  // Idempotent: everything before the marker is kept verbatim, the block
  // is rebuilt. No separator is injected, so re-running cannot stack one.
  const base = (
    existing.includes(MARK_START)
      ? existing.slice(0, existing.indexOf(MARK_START))
      : existing
  ).replace(/\s+$/, "");
  fs.writeFileSync(args.out, `${base}\n\n${block}`);
  console.log(
    `✓ History appended to ${args.out} (prescription untouched, ` +
      `${logs.length} sets, ${comments.length} comments)`
  );
  process.exit(0);
}

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

  out += `## SESSION ${i + 1} — ${weekTitle(w, i)}\n\n`;

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

  // What actually happened, interleaved under the session it belongs to.
  out += renderHistory(wItems, 3);

  out += `---\n\n`;
}

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, out);
console.log(`✓ Wrote ${args.out}`);
