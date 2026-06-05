// One-shot: import the 14 warm-up templates that used to live in
// src/lib/warmupTemplates.ts (built from
// Bibliothèque/warmup_templates.md) into the new Supabase `templates`
// table. Skips templates that already exist (matched by name).

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
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
const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// Pull the typed module so we don't reimplement the markdown parser.
const tsSrc = fs.readFileSync(
  path.join(ROOT, "ldmove-site", "src", "lib", "warmupTemplates.ts"),
  "utf8"
);
// The JSON payload lives right after `WARMUP_TEMPLATES: …[] = `.
const m = tsSrc.match(/WARMUP_TEMPLATES[^=]*=\s*(\[[\s\S]*?\]);/);
if (!m) throw new Error("Could not locate WARMUP_TEMPLATES array");
const templates = JSON.parse(m[1]);
console.log(`Source: ${templates.length} warm-up template(s).`);

// Check what's already in the DB so we don't double-import.
const existing = await (await fetch(
  `${SUPABASE_URL}/rest/v1/templates?select=name&type=eq.warmup`,
  { headers: HEADERS }
)).json();
const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));
console.log(`Already in DB: ${existingNames.size}`);

const payload = templates
  .filter((t) => !existingNames.has(t.name.toLowerCase()))
  .map((t) => ({
    type: "warmup",
    name: t.name,
    description: null,
    exercises: t.exercises,
  }));

if (payload.length === 0) {
  console.log("Nothing to insert — all templates already in Supabase.");
  process.exit(0);
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/templates`, {
  method: "POST",
  headers: { ...HEADERS, Prefer: "return=representation" },
  body: JSON.stringify(payload),
});
if (!res.ok) {
  console.error(`Insert failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const inserted = await res.json();
console.log(`✓ Inserted ${inserted.length} warm-up template(s).`);
for (const t of inserted) console.log(`  · ${t.name}`);
