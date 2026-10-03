// Rebuild Clients/../commentaires_par_exercice.md: every coaching cue
// Maxime has already written, gathered per exercise, as raw material for
// the library descriptions.
//
// Usage:
//   node scripts/build-comment-sheet.mjs [--out <path>]
//
// Two sources, and the second one is the point of this script:
//
//   1. program_items.notes — the COM column of a block. This is what the
//      first version of the sheet (2026-08-13) had, and all it had.
//   2. exercise_comments — the form-check threads. 377 of Maxime's
//      replies hang off library exercises, and they are the better
//      material: a COM note is written before the client moves, a form
//      check reply is written after watching them move.
//
// A coach reply often only makes sense next to what it answers. The
// threads are flat (parent_id is set on exactly zero of the 693 rows),
// so the question is recovered by chronology instead: the client message
// immediately before a coach reply on the same exercise. That is 178 of
// them, roughly half.
//
// This script PUBLISHES NOTHING. Descriptions reach the library only
// through the ✓ = "V" column of LD-Move-descriptions-exercices.xlsx, see
// sync-all-exercises-from-biblio.mjs. The sheet is for reading.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const next = arr[i + 1];
      acc.push([cur.slice(2), !next || next.startsWith("--") ? true : next]);
    }
    return acc;
  }, [])
);
const OUT = args.out ?? path.join(ROOT, "commentaires_par_exercice.md");

// --- Env ---
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, "ldmove-site/.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
  process.exit(1);
}

/** PostgREST caps a response at 1000 rows whatever ?limit says, so every
 *  read here pages. See the project note on silent truncation. */
async function all(pathAndQuery) {
  const out = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${URL}/rest/v1/${pathAndQuery}&limit=1000&offset=${offset}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const json = await res.json();
    if (!Array.isArray(json)) {
      console.error(pathAndQuery, json);
      process.exit(1);
    }
    out.push(...json);
    if (json.length < 1000) break;
    offset += 1000;
  }
  return out;
}

const [comments, items, weeks, programs, exercises, profiles] = await Promise.all([
  all("exercise_comments?select=id,item_id,author_id,author_role,body,parent_id,created_at,image_urls&order=created_at"),
  all("program_items?select=id,week_id,custom_name,exercise_id,notes&order=order_index"),
  all("program_weeks?select=id,program_id,week_number,title&order=week_number"),
  all("programs?select=id,title,assigned_client_id&order=created_at"),
  all("exercises?select=id,name,description&order=name"),
  all("profiles?select=id,first_name,role&order=first_name"),
]);

const weekProgram = new Map(weeks.map((w) => [w.id, w.program_id]));
const programById = new Map(programs.map((p) => [p.id, p]));
const exerciseById = new Map(exercises.map((e) => [e.id, e]));
const nameOf = new Map(profiles.map((p) => [p.id, p.first_name || "?"]));

/** The library name when the item is linked, otherwise the name the
 *  coach typed, minus its [SECTION] prefix. */
function exerciseKey(item) {
  if (item.exercise_id && exerciseById.has(item.exercise_id)) {
    return { name: exerciseById.get(item.exercise_id).name, inLibrary: true };
  }
  const raw = (item.custom_name || "").replace(/^\[[^\]]*\]\s*/, "").trim();
  return { name: raw || "(sans nom)", inLibrary: false };
}

function clientOf(item) {
  const program = programById.get(weekProgram.get(item.week_id));
  return {
    client: program ? nameOf.get(program.assigned_client_id) ?? "?" : "?",
    block: program ? program.title : "?",
  };
}

const itemById = new Map(items.map((i) => [i.id, i]));

/** For every coach comment, the client message right before it on the
 *  same exercise, or null. Built once by walking each exercise's thread
 *  in order. */
const askedBefore = new Map();
{
  const byItem = new Map();
  for (const c of comments) {
    if (!byItem.has(c.item_id)) byItem.set(c.item_id, []);
    byItem.get(c.item_id).push(c);
  }
  for (const thread of byItem.values()) {
    thread.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    for (let i = 1; i < thread.length; i++) {
      if (thread[i].author_role !== "coach") continue;
      const prev = thread[i - 1];
      if (prev.author_role === "client" && (prev.body || "").trim()) {
        askedBefore.set(thread[i].id, prev.body.trim());
      }
    }
  }
}

/** Anything shorter than this is an acknowledgement, not a cue: "ok",
 *  "Top", "Ok fine", "yes". Counted and reported, never written out,
 *  because a sheet padded with them is a sheet nobody reads. */
const MIN_USEFUL = 20;

const entries = new Map(); // exercise name -> { inLibrary, checks:[], notes:[] }
function bucket(name, inLibrary) {
  if (!entries.has(name)) entries.set(name, { inLibrary, checks: [], notes: [] });
  const e = entries.get(name);
  // A name can appear both linked and hand-typed; linked wins.
  if (inLibrary) e.inLibrary = true;
  return e;
}

// --- Source 1: form-check threads ---
let shortSkipped = 0;
for (const c of comments) {
  if (c.author_role !== "coach") continue;
  const item = itemById.get(c.item_id);
  if (!item) continue;
  const body = (c.body || "").trim();
  if (body.length < MIN_USEFUL) {
    shortSkipped++;
    continue;
  }
  const { name, inLibrary } = exerciseKey(item);
  const { client, block } = clientOf(item);
  bucket(name, inLibrary).checks.push({
    body,
    client,
    block,
    date: c.created_at.slice(0, 10),
    asked: askedBefore.get(c.id) ?? null,
    withImage: Array.isArray(c.image_urls) && c.image_urls.length > 0,
  });
}

// --- Source 2: the COM column of the blocks ---
for (const item of items) {
  const notes = (item.notes || "").trim();
  if (!notes) continue;
  // Strip the structured prefixes the editor writes, keep the prose.
  const prose = notes
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && !/^(Tempo|Load)\s*:/i.test(p))
    .join(" · ");
  if (prose.length < MIN_USEFUL) continue;
  const { name, inLibrary } = exerciseKey(item);
  const { client, block } = clientOf(item);
  bucket(name, inLibrary).notes.push({ body: prose, client, block });
}

/** Collapse repeats of the same text, keeping every client it was sent
 *  to. The same cue written to four clients is one cue, and the fact it
 *  was written four times is itself a signal it belongs in the library. */
function dedupe(list) {
  const seen = new Map();
  for (const x of list) {
    const key = x.body.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(key)) {
      seen.set(key, { ...x, clients: new Set([x.client]), blocks: new Set([x.block]), times: 1 });
    } else {
      const s = seen.get(key);
      s.clients.add(x.client);
      s.blocks.add(x.block);
      s.times++;
      if (x.date && (!s.date || x.date > s.date)) s.date = x.date;
      if (x.asked && !s.asked) s.asked = x.asked;
    }
  }
  // Longest first: the fullest phrasing of a cue is the one to read.
  return [...seen.values()].sort((a, b) => b.body.length - a.body.length);
}

for (const e of entries.values()) {
  e.checks = dedupe(e.checks);
  e.notes = dedupe(e.notes);
  e.weight = e.checks.length * 2 + e.notes.length; // form checks count double
}

const lib = [...entries.entries()]
  .filter(([, e]) => e.inLibrary)
  .sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]));
const free = [...entries.entries()]
  .filter(([, e]) => !e.inLibrary)
  .sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]));

const covered = new Set(lib.map(([n]) => n));
const bare = exercises
  .map((e) => e.name)
  .filter((n) => !covered.has(n))
  .sort((a, b) => a.localeCompare(b));

const describedInDb = exercises.filter((e) => e.description && e.description.trim()).length;
const coachTotal = comments.filter((c) => c.author_role === "coach").length;
const checksCount = lib.concat(free).reduce((s, [, e]) => s + e.checks.length, 0);
const notesCount = lib.concat(free).reduce((s, [, e]) => s + e.notes.length, 0);

// --- Render ---
const L = [];
const today = new Date().toISOString().slice(0, 10);

L.push("# Commentaires coach par exercice");
L.push("");
L.push("> Matiere premiere pour rediger les descriptions de la bibliotheque.");
L.push(`> Regenere le ${today} par \`scripts/build-comment-sheet.mjs\`.`);
L.push(">");
L.push("> **Ce fichier ne publie rien.** Une description n'arrive dans");
L.push("> l'application que par la colonne ✓ = \"V\" de");
L.push("> LD-Move-descriptions-exercices.xlsx. Ici on lit, on ne valide pas.");
L.push("");
L.push("| | |");
L.push("|---|---|");
L.push(`| Exercices dans la bibliotheque | ${exercises.length} |`);
L.push(`| Dont avec une description en base | ${describedInDb} |`);
L.push(`| Commentaires coach au total | ${coachTotal} |`);
L.push(`| Retours form check retenus | ${checksCount} |`);
L.push(`| Notes de programme retenues | ${notesCount} |`);
L.push(`| Accuses de reception ecartes (< ${MIN_USEFUL} car.) | ${shortSkipped} |`);
L.push(`| Exercices de la biblio avec de la matiere | ${lib.length} |`);
L.push(`| Exercices de la biblio sans rien | ${bare.length} |`);
L.push(`| Noms hors bibliotheque avec de la matiere | ${free.length} |`);
L.push("");
L.push("Les retours form check passent en premier et comptent double dans le");
L.push("tri : une note COM est ecrite avant que le client bouge, un retour de");
L.push("form check est ecrit apres l'avoir vu bouger.");
L.push("");
L.push("---");
L.push("");

function renderBlock(list, heading, blurb) {
  L.push(`## ${heading}`);
  L.push("");
  if (blurb) {
    L.push(blurb);
    L.push("");
  }
  for (const [name, e] of list) {
    const tags = [];
    if (e.checks.length) tags.push(`${e.checks.length} form check`);
    if (e.notes.length) tags.push(`${e.notes.length} note${e.notes.length > 1 ? "s" : ""} COM`);
    L.push(`### ${name}`);
    L.push(`<sub>${tags.join(" · ")}</sub>`);
    L.push("");
    if (e.checks.length) {
      L.push("**Retours form check**");
      L.push("");
      for (const c of e.checks) {
        const who = [...c.clients].join(", ");
        const rep = c.times > 1 ? ` · ${c.times}x` : "";
        const img = c.withImage ? " · avec photo" : "";
        L.push(`- ${c.body.replace(/\s+/g, " ")}`);
        L.push(`  <sub>${who} · ${c.date}${rep}${img}</sub>`);
        if (c.asked) {
          L.push(
            `  <sub>en reponse a : "${c.asked.replace(/\s+/g, " ").slice(0, 200)}"</sub>`
          );
        }
        L.push("");
      }
    }
    if (e.notes.length) {
      L.push("**Notes de programme (COM)**");
      L.push("");
      for (const n of e.notes) {
        const who = [...n.clients].join(", ");
        const blocks = [...n.blocks].slice(0, 2).join(", ");
        const rep = n.times > 1 ? ` · ${n.times}x` : "";
        L.push(`- ${n.body.replace(/\s+/g, " ")}`);
        L.push(`  <sub>${who} · ${blocks}${rep}</sub>`);
        L.push("");
      }
    }
  }
}

renderBlock(
  lib,
  `BIBLIOTHEQUE : exercices avec de la matiere (${lib.length})`,
  "A rediger en priorite. Ces exercices existent dans l'application et tu as deja ecrit dessus."
);

L.push("---");
L.push("");
renderBlock(
  free,
  `HORS BIBLIOTHEQUE : noms tapes a la main (${free.length})`,
  "Noms ecrits directement dans un bloc, jamais ajoutes a la bibliotheque. A creer, ou a renommer pour rejoindre un exercice existant."
);

L.push("---");
L.push("");
L.push(`## BIBLIOTHEQUE : exercices sans aucune matiere (${bare.length})`);
L.push("");
L.push("Rien d'ecrit dessus a ce jour, ni en COM ni en form check. La description devra partir de zero.");
L.push("");
for (const n of bare) L.push(`- ${n}`);
L.push("");

fs.writeFileSync(OUT, L.join("\n"));
console.log(`✓ ${OUT}`);
console.log(`  ${lib.length} exercices de la biblio avec matiere, ${free.length} noms hors biblio, ${bare.length} sans rien`);
console.log(`  ${checksCount} retours form check, ${notesCount} notes COM, ${shortSkipped} accuses de reception ecartes`);
