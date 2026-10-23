// Raw material for social media ideas, read from the app. Read-only.
//
// Usage:
//   node scripts/content-sources.mjs [--days 60] [--topic compression]
//
// Prints, for the last N days: what clients wrote on their exercises
// (questions, struggles, wins), the notes they sent with form checks, the
// videos the coach archived as progress milestones, and the coach's own
// replies. With --topic, the coach replies are narrowed to exercises whose
// name matches, which is where the cues for a given video come from.
//
// Client names are printed so the coach knows the context. They never go
// into a post: the social media skill turns a question into a topic.

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
const days = Number(args.days ?? 60);
const topic = typeof args.topic === "string" ? new RegExp(args.topic, "i") : null;

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, "ldmove-site", ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const U = env.VITE_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };
const get = async (p) => {
  const res = await fetch(`${U}/rest/v1/${p}`, { headers: H });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const since = new Date(Date.now() - days * 864e5).toISOString();
const oneLine = (s, n = 220) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const exercise = (r) => (r.program_items?.custom_name ?? "").replace(/^\[[A-Z ]+\]\s*/, "");

// Scoped by date, so well under the 1000-row cap of PostgREST.
const [clientComments, notes, milestones, coachReplies] = await Promise.all([
  get(`exercise_comments?select=body,created_at,profiles(first_name),program_items(custom_name)&author_role=eq.client&created_at=gte.${since}&order=created_at.desc&limit=1000`),
  get(`form_check_submissions?select=client_note,created_at,profiles(first_name),program_items(custom_name)&client_note=not.is.null&created_at=gte.${since}&order=created_at.desc&limit=1000`),
  get(`form_check_submissions?select=archived_note,archived_at,profiles(first_name),program_items(custom_name)&archived_as_progress=eq.true&archived_at=gte.${since}&order=archived_at.desc&limit=1000`),
  get(`exercise_comments?select=body,created_at,program_items(custom_name)&author_role=eq.coach&created_at=gte.${since}&order=created_at.desc&limit=1000`),
]);

console.log(`# Sources de contenu, ${days} derniers jours\n`);

console.log(`## Ce que les clients écrivent sur leurs exercices (${clientComments.length})`);
for (const c of clientComments)
  if (oneLine(c.body).length > 12)
    console.log(`- ${c.profiles?.first_name ?? "?"} | ${exercise(c)} | ${oneLine(c.body)}`);

console.log(`\n## Notes envoyées avec les form checks (${notes.length})`);
for (const f of notes)
  if (oneLine(f.client_note).length > 12)
    console.log(`- ${f.profiles?.first_name ?? "?"} | ${exercise(f)} | ${oneLine(f.client_note)}`);

console.log(`\n## Réussites archivées (${milestones.length})`);
for (const m of milestones)
  console.log(`- ${m.profiles?.first_name ?? "?"} | ${exercise(m)} | ${oneLine(m.archived_note)} | ${m.archived_at?.slice(0, 10)}`);

const replies = coachReplies.filter(
  (c) => oneLine(c.body).length > 30 && (!topic || topic.test(exercise(c)))
);
console.log(`\n## Réponses du coach${topic ? ` (sujet : ${args.topic})` : ""} (${replies.length})`);
for (const c of replies) console.log(`- ${exercise(c)} | ${oneLine(c.body, 300)}`);
