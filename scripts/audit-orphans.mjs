// Quick audit: find any DB row or storage file pointing to a user
// that no longer exists. Used to verify a hard-delete left nothing
// behind.
//
// Usage: node scripts/audit-orphans.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const envPath = path.join(ROOT, "ldmove-site", ".env.local");
const envRaw = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envRaw
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    })
);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(method, p, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listStorageFolder(bucket) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${bucket}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: "", limit: 1000 }),
    }
  );
  if (!res.ok)
    throw new Error(`list ${bucket} → ${res.status}: ${await res.text()}`);
  return res.json();
}

const profiles = await sb("GET", "profiles?select=id,first_name,last_name,email");
const knownIds = new Set(profiles.map((p) => p.id));
console.log(`Known profiles: ${profiles.length}`);
profiles.forEach((p) =>
  console.log(`  · ${p.first_name ?? ""} ${p.last_name ?? ""} (${p.email})`)
);

console.log("\n--- Programs (custom) ---");
const programs = await sb(
  "GET",
  "programs?select=id,title,type,assigned_client_id,is_archived,created_at&type=eq.custom&order=created_at.desc"
);
let progOrphans = 0;
for (const p of programs) {
  if (p.assigned_client_id && !knownIds.has(p.assigned_client_id)) {
    console.log(`  ORPHAN: "${p.title}" → client_id=${p.assigned_client_id} not in profiles`);
    progOrphans++;
  } else if (!p.assigned_client_id) {
    console.log(`  unassigned: "${p.title}" (assigned_client_id=null)`);
  }
}
console.log(`Custom programs total: ${programs.length} · orphans: ${progOrphans}`);

console.log("\n--- Workout logs ---");
const logs = await sb("GET", "workout_logs?select=client_id&limit=2000");
const logOrphans = logs.filter((l) => l.client_id && !knownIds.has(l.client_id));
console.log(`Total logs: ${logs.length} · orphans: ${logOrphans.length}`);

console.log("\n--- Form check submissions ---");
const submissions = await sb(
  "GET",
  "form_check_submissions?select=id,client_id,video_url"
);
const subOrphans = submissions.filter(
  (s) => s.client_id && !knownIds.has(s.client_id)
);
console.log(`Total submissions: ${submissions.length} · orphans: ${subOrphans.length}`);

console.log("\n--- Exercise comments ---");
const comments = await sb("GET", "exercise_comments?select=id,author_id&limit=2000");
const orphanComments = comments.filter(
  (c) => c.author_id && !knownIds.has(c.author_id)
);
const nullAuthor = comments.filter((c) => !c.author_id);
console.log(
  `Total comments: ${comments.length} · with-orphan-author: ${orphanComments.length} · author=null: ${nullAuthor.length}`
);

console.log("\n--- Client intakes ---");
const intakes = await sb("GET", "client_intakes?select=client_id");
const intakeOrphans = intakes.filter((i) => !knownIds.has(i.client_id));
console.log(`Total intakes: ${intakes.length} · orphans: ${intakeOrphans.length}`);

console.log("\n--- Assessment videos (DB rows) ---");
const av = await sb("GET", "assessment_videos?select=client_id");
const avOrphans = av.filter((v) => !knownIds.has(v.client_id));
console.log(`Total assessment_videos rows: ${av.length} · orphans: ${avOrphans.length}`);

console.log("\n--- Storage: form-checks ---");
try {
  const files = await listStorageFolder("form-checks");
  // Top-level folders should be UUIDs of users.
  const folders = new Set(
    files
      .filter((f) => f.name)
      .map((f) => (f.name.includes("/") ? f.name.split("/")[0] : f.name))
  );
  let orphans = 0;
  for (const folder of folders) {
    if (!knownIds.has(folder)) {
      console.log(`  ORPHAN folder: form-checks/${folder}/`);
      orphans++;
    }
  }
  console.log(`form-checks: ${folders.size} top-level folders · orphans: ${orphans}`);
} catch (e) {
  console.error("form-checks list failed", e.message);
}

console.log("\n--- Storage: assessment-videos ---");
try {
  const files = await listStorageFolder("assessment-videos");
  const folders = new Set(
    files
      .filter((f) => f.name)
      .map((f) => (f.name.includes("/") ? f.name.split("/")[0] : f.name))
  );
  let orphans = 0;
  for (const folder of folders) {
    if (!knownIds.has(folder)) {
      console.log(`  ORPHAN folder: assessment-videos/${folder}/`);
      orphans++;
    }
  }
  console.log(
    `assessment-videos: ${folders.size} top-level folders · orphans: ${orphans}`
  );
} catch (e) {
  console.error("assessment-videos list failed", e.message);
}

console.log("\nDone.");
