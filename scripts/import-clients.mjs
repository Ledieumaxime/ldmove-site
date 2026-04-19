// Import LD Move clients' programs from local markdown files into Supabase.
// Reads /Users/maximeledieu/Desktop/Ld_move/Clients/<Name>/*.md
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (alongside VITE_SUPABASE_URL).
// Run: node scripts/import-clients.mjs
//
// Idempotent: skips programs whose slug already exists.

import fs from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const CLIENTS_DIR = path.join(ROOT, "Clients");

// --- Load env ---
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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// --- Clients config ---
const CLIENTS = [
  { folder: "Alexandro", first_name: "Alexandro", email: "alejandrodragoc@gmail.com" },
  { folder: "Aman", first_name: "Aman", email: "aman.osteopath@gmail.com" },
  { folder: "Cym", first_name: "Cym", email: "cymron@cymron.com" },
  { folder: "Mayur", first_name: "Mayur", email: "mclodhia@gmail.com" },
  { folder: "Ogulcan", first_name: "Ogulcan", email: "ogulcandamar@gmail.com" },
];

// --- Supabase REST helpers (service role, bypasses RLS) ---
async function sb(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${txt}`);
  }
  return res.json();
}

// --- Markdown parsing helpers ---

function parseRestToSeconds(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (!t || t === "-" || t === "0") return t === "0" ? 0 : null;

  // e.g. "2min30", "1min", "90s", "60", "3 min"
  const minMatch = t.match(/(\d+)\s*min\s*(\d*)/);
  if (minMatch) {
    const min = parseInt(minMatch[1], 10);
    const sec = minMatch[2] ? parseInt(minMatch[2], 10) : 0;
    return min * 60 + sec;
  }
  const secMatch = t.match(/(\d+)\s*s/);
  if (secMatch) return parseInt(secMatch[1], 10);
  const plain = parseInt(t, 10);
  if (!isNaN(plain)) return plain;
  return null;
}

function parseSets(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

function cleanCell(c) {
  return (c ?? "").replace(/\s+/g, " ").trim();
}

function extractUrl(cell) {
  if (!cell) return null;
  // Markdown link [text](url) — take first URL
  const m = cell.match(/\((https?:\/\/[^\s)]+)\)/);
  if (m) return m[1];
  // Raw URL
  const raw = cell.match(/https?:\/\/\S+/);
  return raw ? raw[0] : null;
}

function stripMdBold(s) {
  return s.replace(/^\s*\*\*(.*?)\*\*\s*$/, "$1").trim();
}

// Detects grouping markers like **SUPERSET 1**, **TRI-SET 2**, **DROP SET**, **CIRCUIT A**
const GROUP_RE = /^((?:SUPER[\s-]?SET|TRI[\s-]?SET|DROP[\s-]?SET|CIRCUIT|GIANT[\s-]?SET|ROUND)\s*[A-Z0-9]*)$/i;

// Parses a markdown table block and returns an array of row-objects with group_name.
// Rule: after a group marker, the first exo starts the group. Subsequent exos with
// EMPTY `set` cell remain in the group. An exo with filled `set` cell (and no new
// marker) ends the group.
function parseTable(lines) {
  const rows = [];
  const cleanLines = lines.filter((l) => l.trim().startsWith("|"));
  if (cleanLines.length < 3) return rows; // header, sep, data

  let currentGroup = null;
  let firstExoOfGroup = false;

  for (let i = 2; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const cells = line.split("|").slice(1, -1).map(cleanCell);
    if (cells.every((c) => !c)) continue;
    const [exercise, set, rep, tempo, load, rest, video, com] = cells;

    // Group marker row?
    const stripped = stripMdBold(exercise).trim();
    const groupMatch = stripped.match(GROUP_RE);
    if (groupMatch && !set && !rep) {
      currentGroup = stripped.replace(/\s+/g, " ").toUpperCase();
      firstExoOfGroup = true;
      continue;
    }

    if (!exercise) continue;

    // Determine group membership
    let groupName = null;
    if (currentGroup) {
      if (firstExoOfGroup) {
        groupName = currentGroup;
        firstExoOfGroup = false;
      } else if (!set) {
        groupName = currentGroup;
      } else {
        // Filled set after initial → out of group
        currentGroup = null;
      }
    }

    rows.push({
      exercise: stripMdBold(exercise),
      set,
      rep,
      tempo,
      load,
      rest,
      video,
      com,
      group_name: groupName,
    });
  }
  return rows;
}

// Parses a whole .md file into { title, description, weeks: [{title, notes, items: [...] }] }
function parseMarkdown(content) {
  const lines = content.split("\n");
  const res = { title: "", description: "", weeks: [] };

  let i = 0;

  // 1. Title (first # line)
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("# ")) {
      res.title = l.replace(/^#\s+/, "").trim();
      i++;
      break;
    }
    i++;
  }

  // 2. Metadata until first ## or ---
  const metaLines = [];
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("## ") || l.startsWith("---")) break;
    if (l.trim()) metaLines.push(l.trim().replace(/^\*\*|\*\*$/g, ""));
    i++;
  }
  res.description = metaLines.join("\n").trim();

  // 3. Parse sessions (## ...) — each becomes a "week"
  let currentSession = null;
  let currentSubsection = "";
  let tableBuffer = null;

  const flushTable = () => {
    if (currentSession && tableBuffer && tableBuffer.length > 0) {
      const rows = parseTable(tableBuffer);
      for (const r of rows) {
        const label = currentSubsection ? `[${currentSubsection}] ${r.exercise}` : r.exercise;
        const notesParts = [];
        if (r.tempo) notesParts.push(`Tempo: ${r.tempo}`);
        if (r.load) notesParts.push(`Load: ${r.load}`);
        if (r.com) notesParts.push(r.com);
        currentSession.items.push({
          custom_name: label,
          sets: parseSets(r.set),
          reps: r.rep || null,
          rest_seconds: parseRestToSeconds(r.rest),
          notes: notesParts.length ? notesParts.join(" | ") : null,
          video_url: extractUrl(r.video),
          group_name: r.group_name ?? null,
        });
      }
    }
    tableBuffer = null;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      flushTable();
      currentSubsection = "";
      currentSession = {
        title: trimmed.replace(/^##\s+/, "").trim(),
        notes: null,
        items: [],
      };
      res.weeks.push(currentSession);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushTable();
      currentSubsection = trimmed.replace(/^###\s+/, "").trim();
      continue;
    }

    // Standalone bold headers like **SPINE MOBILITY**
    if (/^\*\*[^*]+\*\*$/.test(trimmed) && !line.startsWith("|")) {
      flushTable();
      currentSubsection = trimmed.replace(/\*\*/g, "").trim();
      continue;
    }

    if (trimmed.startsWith("|")) {
      if (!tableBuffer) tableBuffer = [];
      tableBuffer.push(line);
      continue;
    }

    // Non-table, non-header line → end of table
    if (tableBuffer && trimmed === "") {
      flushTable();
    }
  }
  flushTable();

  return res;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Main import ---

async function findCoachId() {
  const rows = await sb("GET", "profiles?role=eq.coach&select=id&limit=1");
  if (!rows.length) throw new Error("No coach profile found");
  return rows[0].id;
}

async function findClientByEmail(email) {
  const rows = await sb(
    "GET",
    `profiles?email=ilike.${encodeURIComponent(email)}&select=id,first_name`
  );
  return rows[0] ?? null;
}

async function ensureClientProfile(client) {
  const existing = await findClientByEmail(client.email);
  if (!existing) {
    console.warn(`  ⚠️  No profile for ${client.email} — was the auth user created?`);
    return null;
  }
  // Patch first_name if empty
  if (!existing.first_name) {
    await sb("PATCH", `profiles?id=eq.${existing.id}`, { first_name: client.first_name });
  }
  return existing.id;
}

async function programExistsBySlug(slug) {
  const rows = await sb("GET", `programs?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
  return rows[0]?.id ?? null;
}

async function importProgramFile(client, clientId, coachId, filePath) {
  const content = await readFile(filePath, "utf8");
  const parsed = parseMarkdown(content);
  if (!parsed.title) {
    console.warn(`  ⚠️  No # title in ${filePath}, skipping`);
    return;
  }
  const slug = `${slugify(client.folder)}-${slugify(parsed.title)}`;
  const existing = await programExistsBySlug(slug);
  if (existing) {
    console.log(`  ↷  Skip (already imported): ${parsed.title}`);
    return;
  }

  const [prog] = await sb("POST", "programs", {
    slug,
    title: parsed.title,
    description: parsed.description || null,
    type: "custom",
    owner_coach_id: coachId,
    assigned_client_id: clientId,
    price_eur: 0,
    billing_type: "one_time",
    duration_weeks: parsed.weeks.length || null,
    is_published: true,
  });

  let weekNum = 1;
  for (const w of parsed.weeks) {
    const [weekRow] = await sb("POST", "program_weeks", {
      program_id: prog.id,
      week_number: weekNum++,
      title: w.title,
      notes: w.notes,
    });
    let order = 0;
    for (const it of w.items) {
      await sb("POST", "program_items", {
        week_id: weekRow.id,
        order_index: order++,
        custom_name: it.custom_name,
        sets: it.sets,
        reps: it.reps,
        rest_seconds: it.rest_seconds,
        notes: it.notes,
        video_url: it.video_url,
        group_name: it.group_name,
      });
    }
  }
  console.log(
    `  ✓  ${parsed.title} — ${parsed.weeks.length} sessions, ${parsed.weeks.reduce(
      (s, w) => s + w.items.length,
      0
    )} exos`
  );
}

async function run() {
  console.log("=== LD Move client import ===\n");
  const coachId = await findCoachId();
  console.log(`Coach id: ${coachId}\n`);

  for (const client of CLIENTS) {
    console.log(`\n── ${client.first_name} (${client.email}) ──`);
    const clientId = await ensureClientProfile(client);
    if (!clientId) {
      console.log("  (skipped)");
      continue;
    }

    const dir = path.join(CLIENTS_DIR, client.folder);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !f.includes("_profil"))
      .sort();

    for (const f of files) {
      try {
        await importProgramFile(client, clientId, coachId, path.join(dir, f));
      } catch (e) {
        console.error(`  ✗  ${f} → ${e.message}`);
      }
    }
  }

  console.log("\n=== Done ===");
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
