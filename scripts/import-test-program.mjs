// One-off: import a specific markdown block as a program for the Client teste (ledieumaxime@icloud.com).
// Usage: node scripts/import-test-program.mjs
//
// Reuses the same parsing logic as import-clients.mjs.

import fs from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";

const ROOT = "/Users/maximeledieu/Desktop/Ld_move";
const SOURCE_FILE = path.join(ROOT, "Clients", "Pratik", "pratik_bloc_2_april.md");
const TARGET_CLIENT_EMAIL = "ledieumaxime@icloud.com";
const SLUG_PREFIX = "client-teste";

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

async function sb(method, p, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
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
    throw new Error(`${method} ${p} → ${res.status}: ${txt}`);
  }
  return res.json();
}

// --- Parsing (copied from import-clients.mjs) ---
function parseRestToSeconds(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (!t || t === "-" || t === "0") return t === "0" ? 0 : null;
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
  const m = cell.match(/\((https?:\/\/[^\s)]+)\)/);
  if (m) return m[1];
  const raw = cell.match(/https?:\/\/\S+/);
  return raw ? raw[0] : null;
}

function stripMdBold(s) {
  return s.replace(/^\s*\*\*(.*?)\*\*\s*$/, "$1").trim();
}

const GROUP_RE = /^((?:SUPER[\s-]?SET|TRI[\s-]?SET|DROP[\s-]?SET|CIRCUIT|GIANT[\s-]?SET|ROUND)\s*[A-Z0-9]*)$/i;

function parseTable(lines) {
  const rows = [];
  const cleanLines = lines.filter((l) => l.trim().startsWith("|"));
  if (cleanLines.length < 3) return rows;

  let currentGroup = null;
  let firstExoOfGroup = false;

  for (let i = 2; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const cells = line.split("|").slice(1, -1).map(cleanCell);
    if (cells.every((c) => !c)) continue;
    const [exercise, set, rep, tempo, load, rest, video, com] = cells;

    const stripped = stripMdBold(exercise).trim();
    const groupMatch = stripped.match(GROUP_RE);
    if (groupMatch && !set && !rep) {
      currentGroup = stripped.replace(/\s+/g, " ").toUpperCase();
      firstExoOfGroup = true;
      continue;
    }

    if (!exercise) continue;

    let groupName = null;
    if (currentGroup) {
      if (firstExoOfGroup) {
        groupName = currentGroup;
        firstExoOfGroup = false;
      } else if (!set) {
        groupName = currentGroup;
      } else {
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

function parseMarkdown(content) {
  const lines = content.split("\n");
  const res = { title: "", description: "", weeks: [] };

  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("# ")) {
      res.title = l.replace(/^#\s+/, "").trim();
      i++;
      break;
    }
    i++;
  }

  const metaLines = [];
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("## ") || l.startsWith("---")) break;
    if (l.trim()) metaLines.push(l.trim().replace(/^\*\*|\*\*$/g, ""));
    i++;
  }
  res.description = metaLines.join("\n").trim();

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

    if (tableBuffer && trimmed === "") {
      flushTable();
    }
  }
  flushTable();

  // Drop metadata-only sections (e.g. "## Block Information" with bullet lists
  // but no exercise table). They produce empty "weeks" (0 exos) on the client.
  res.weeks = res.weeks.filter((w) => w.items.length > 0);

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

// --- Main ---
async function run() {
  console.log("=== Import programme de test ===\n");
  console.log(`Source: ${SOURCE_FILE}`);
  console.log(`Client cible: ${TARGET_CLIENT_EMAIL}\n`);

  // Find coach
  const coachRows = await sb("GET", "profiles?role=eq.coach&select=id&limit=1");
  if (!coachRows.length) throw new Error("Aucun coach trouvé");
  const coachId = coachRows[0].id;
  console.log(`Coach id: ${coachId}`);

  // Find target client
  const clientRows = await sb(
    "GET",
    `profiles?email=ilike.${encodeURIComponent(TARGET_CLIENT_EMAIL)}&select=id,first_name,last_name`
  );
  if (!clientRows.length) {
    throw new Error(`Aucun profil trouvé pour ${TARGET_CLIENT_EMAIL}`);
  }
  const client = clientRows[0];
  console.log(`Client cible: ${client.first_name} ${client.last_name} (${client.id})\n`);

  // Parse markdown
  const content = await readFile(SOURCE_FILE, "utf8");
  const parsed = parseMarkdown(content);
  if (!parsed.title) throw new Error("Pas de titre # trouvé dans le markdown");

  const slug = `${SLUG_PREFIX}-${slugify(parsed.title)}`;
  console.log(`Slug généré: ${slug}`);

  // Check duplicate
  const existing = await sb("GET", `programs?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
  if (existing.length) {
    console.log(`\n↷  Déjà importé (slug existe). Rien à faire.`);
    return;
  }

  // Insert program
  const [prog] = await sb("POST", "programs", {
    slug,
    title: parsed.title,
    description: parsed.description || null,
    type: "custom",
    owner_coach_id: coachId,
    assigned_client_id: client.id,
    price_eur: 0,
    billing_type: "one_time",
    duration_weeks: parsed.weeks.length || null,
    is_published: true,
  });
  console.log(`\n✓  Programme créé: ${prog.id}`);

  // Insert weeks + items
  let weekNum = 1;
  let totalItems = 0;
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
      totalItems++;
    }
    console.log(`   week ${weekNum - 1}: "${w.title}" — ${w.items.length} exos`);
  }

  console.log(`\n=== Terminé: ${parsed.weeks.length} sessions, ${totalItems} exos ===`);
}

run().catch((e) => {
  console.error("\n❌ Erreur:", e.message);
  process.exit(1);
});
