// Draft the coach note for an exercise from what the coach already told
// THIS client about THIS exercise, in earlier blocks.
//
// The problem it solves: a comment hangs off one block's exercise row,
// so when the same exercise comes back in the next block the thread is
// empty. Measured on the real data, 40% of the workout exercises in
// Aman's Block 4 and Cym's Block 11 already had feedback from the block
// before, and in several cases the coach wrote three fresh cues on an
// exercise he had already explained in June. He was repeating himself
// because the earlier cues were not in front of him.
//
// Scope is deliberate and narrow: one client, one exercise. Never the
// other clients' comments on the same exercise. A cue about Fanny's
// chest compression has no business in Ahmed's block, and a note that
// reads as generic advice is worse than no note.
//
// It does NOT invent coaching, same rule as rewrite-comment. It has not
// seen the client move. Its whole job is to turn what the coach said
// after watching ("you collapse because your chest stays open") into
// what the client should read before training ("roll the spine, keep
// the lower back on the wall").
//
// Coach only. The key lives in Supabase secrets.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Same choice as rewrite-comment: this text goes on a paying client's
// program, and the volume is a handful of presses per block.
const MODEL = "claude-opus-5";
/** Past exchanges fed to the model. More than this and the oldest stop
 *  being relevant to where the client is now. */
const MAX_HISTORY = 12;
/** Under this a comment is an acknowledgement, not a cue. */
const MIN_USEFUL = 20;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "AI key not configured" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userRes } = await admin.auth.getUser(token);
    if (!userRes?.user) return json({ error: "Invalid token" }, 401);
    const { data: caller } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (caller?.role !== "coach") return json({ error: "Coach only" }, 403);

    const { item_id, draft } = await req.json();
    if (!item_id) return json({ error: "item_id required" }, 400);
    if (typeof draft === "string" && draft.length > 2000) {
      return json({ error: "draft too long" }, 400);
    }

    // --- Who and what are we writing about? ---
    const { data: item } = await admin
      .from("program_items")
      .select("id, week_id, custom_name, exercise_id")
      .eq("id", item_id)
      .maybeSingle();
    if (!item) return json({ error: "Exercise not found" }, 404);

    const { data: week } = await admin
      .from("program_weeks")
      .select("program_id")
      .eq("id", item.week_id)
      .maybeSingle();
    const { data: program } = week
      ? await admin
          .from("programs")
          .select("assigned_client_id, title")
          .eq("id", week.program_id)
          .maybeSingle()
      : { data: null as any };
    const clientId = program?.assigned_client_id;
    if (!clientId) return json({ error: "This block has no client" }, 400);

    const exerciseName = stripPrefix(item.custom_name);
    if (!exerciseName) return json({ error: "Name the exercise first" }, 400);

    const { data: client } = await admin
      .from("profiles")
      .select("first_name, language")
      .eq("id", clientId)
      .maybeSingle();
    const language = client?.language === "fr" ? "fr" : "en";
    const target = language === "fr" ? "French" : "English";

    // --- Every row of this exercise in this client's history ---
    const { data: theirPrograms } = await admin
      .from("programs")
      .select("id, title, created_at")
      .eq("assigned_client_id", clientId);
    const programIds = (theirPrograms ?? []).map((p: any) => p.id);
    if (programIds.length === 0) return json({ error: "no_history" }, 404);

    const { data: theirWeeks } = await admin
      .from("program_weeks")
      .select("id, program_id")
      .in("program_id", programIds);
    const weekToProgram = new Map(
      (theirWeeks ?? []).map((w: any) => [w.id, w.program_id])
    );

    const { data: theirItems } = await admin
      .from("program_items")
      .select("id, week_id, custom_name, exercise_id, notes")
      .in("week_id", (theirWeeks ?? []).map((w: any) => w.id));

    // Same exercise means the same library row. Without a library link
    // we fall back to the name, lower-cased and trimmed, which is the
    // best available for the hand-typed ones.
    const sameExercise = (theirItems ?? []).filter((other: any) => {
      if (other.id === item.id) return false;
      if (item.exercise_id) return other.exercise_id === item.exercise_id;
      return (
        !other.exercise_id &&
        stripPrefix(other.custom_name).toLowerCase() ===
          exerciseName.toLowerCase()
      );
    });
    if (sameExercise.length === 0) return json({ error: "no_history" }, 404);

    const programById = new Map(
      (theirPrograms ?? []).map((p: any) => [p.id, p])
    );
    const blockOf = (it: any) => {
      const p = programById.get(weekToProgram.get(it.week_id));
      return { title: p?.title ?? "?", created: p?.created_at ?? "" };
    };

    // --- The exchanges on those rows ---
    const { data: comments } = await admin
      .from("exercise_comments")
      .select("item_id, author_role, body, created_at")
      .in("item_id", sameExercise.map((i: any) => i.id))
      .order("created_at", { ascending: true });

    // parent_id is unused in this database, so a reply's question is the
    // client message immediately before it on the same row.
    const byRow = new Map<string, any[]>();
    for (const c of comments ?? []) {
      if (!byRow.has(c.item_id)) byRow.set(c.item_id, []);
      byRow.get(c.item_id)!.push(c);
    }
    const history: { date: string; block: string; said: string; asked: string | null }[] = [];
    for (const [rowId, thread] of byRow) {
      const row = sameExercise.find((i: any) => i.id === rowId);
      const { title } = blockOf(row);
      for (let i = 0; i < thread.length; i++) {
        const c = thread[i];
        if (c.author_role !== "coach") continue;
        const body = (c.body ?? "").trim();
        if (body.length < MIN_USEFUL) continue;
        const prev = i > 0 ? thread[i - 1] : null;
        history.push({
          date: c.created_at.slice(0, 10),
          block: title,
          said: body,
          asked:
            prev && prev.author_role === "client" && (prev.body ?? "").trim()
              ? prev.body.trim()
              : null,
        });
      }
    }

    // The coach notes he wrote on this exercise before, same material in
    // a different voice: written ahead of the session rather than after.
    const pastNotes: { block: string; note: string }[] = [];
    for (const row of sameExercise) {
      const prose = proseOfNotes(row.notes);
      if (prose.length < MIN_USEFUL) continue;
      pastNotes.push({ block: blockOf(row).title, note: prose });
    }

    if (history.length === 0 && pastNotes.length === 0) {
      return json({ error: "no_history" }, 404);
    }

    history.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
    const used = history.slice(0, MAX_HISTORY);

    // --- The coach's voice, in the language this client reads ---
    const { data: past } = await admin
      .from("exercise_comments")
      .select("body")
      .eq("author_role", "coach")
      .order("created_at", { ascending: false })
      .limit(200);
    const isFrench = (s: string) =>
      /\b(tu|ton|ta|tes|pour|avec|dans|garde|comme|peux|dois)\b/i.test(s);
    const examples = (past ?? [])
      .map((r: any) => (r.body ?? "").trim())
      .filter((b: string) => b.length > 40 && b.length < 300)
      .filter((b: string) => (language === "fr" ? isFrench(b) : !isFrench(b)))
      .slice(0, 12);

    const system = [
      `You write the coach note for one exercise on one client's training program.`,
      `The coach is French and coaches in ${target}. The client reads ${target}.`,
      ``,
      `The note sits under the exercise in the app. The client reads it just`,
      `before performing the movement, on their phone, in a gym. So it is an`,
      `instruction for the set they are about to do, not a summary of the past.`,
      ``,
      `You are given what this coach already told THIS client about THIS`,
      `exercise in earlier blocks, after watching their videos. Your job is to`,
      `turn that into the one cue that matters now.`,
      ``,
      `Rules, in order of importance:`,
      `1. Use ONLY what the coach said. Never add a cue, a rep count, a tempo,`,
      `   a body part or a piece of advice that is not in the material. You have`,
      `   not seen this client move. Inventing a correction is the one`,
      `   unacceptable failure here.`,
      `2. If the coach already typed something in the note field, that is his`,
      `   current intention: keep it, and let the history sharpen its wording.`,
      `   Do not contradict it and do not drop it.`,
      `3. When the same correction comes back across several blocks, that is the`,
      `   one to write. A point made once in passing is not.`,
      `4. Write forward, not backward. "Roll the spine, keep the lower back on`,
      `   the wall" and not "last time you collapsed because your chest was open".`,
      `   Never mention dates, block names, or that this was said before.`,
      `5. One or two sentences. Thirty words at the very most. This is a note`,
      `   under an exercise, not a paragraph. A long note does not get read.`,
      `6. Second person, direct, warm, his voice. No corporate politeness, no`,
      `   preamble, no "remember to".`,
      `7. The whole note in ${target}, not one word in the other language.`,
      `8. Keep the exact technical terms: compression, protraction, scapular`,
      `   elevation, posterior tilt, hollow, tuck, straddle, lock the elbows.`,
      `   Exercise names stay in English in both languages, that is what the app`,
      `   displays.`,
      ``,
      `Reply with the note alone. No quotes, no preamble, no explanation. If the`,
      `material genuinely contains no usable cue, reply with exactly: NOTHING`,
    ].join("\n");

    const parts: string[] = [];
    parts.push(`Exercise: ${exerciseName}`);
    parts.push(`Client: ${client?.first_name ?? "this client"}`);
    parts.push("");
    if (examples.length) {
      parts.push(
        `How this coach writes, for tone only, do not reuse the content:`
      );
      for (const e of examples) parts.push(`- ${e}`);
      parts.push("");
    }
    if (used.length) {
      parts.push(
        `What he told this client about this exercise, most recent first:`
      );
      for (const h of used) {
        if (h.asked) parts.push(`- The client said: "${clip(h.asked, 300)}"`);
        parts.push(`${h.asked ? "  He replied: " : "- "}${clip(h.said, 700)}`);
      }
      parts.push("");
    }
    if (pastNotes.length) {
      parts.push(`Notes he wrote on this exercise in earlier blocks:`);
      for (const n of pastNotes.slice(0, 6)) parts.push(`- ${clip(n.note, 300)}`);
      parts.push("");
    }
    const typed = typeof draft === "string" ? draft.trim() : "";
    parts.push(
      typed
        ? `What he has already typed in the note field, to keep and sharpen:\n${typed}`
        : `He has typed nothing in the note field yet.`
    );

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: parts.join("\n") }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("anthropic error", res.status, detail);
      return json({ error: "The assistant is unavailable right now" }, 502);
    }

    const data = await res.json();
    // The last text block, not all of them joined: see the same note in
    // rewrite-comment, a reply can arrive with the model's scratch work
    // in earlier blocks.
    const texts = (data?.content ?? [])
      .filter((c: any) => c.type === "text" && typeof c.text === "string")
      .map((c: any) => c.text.trim())
      .filter(Boolean);
    const text = texts.length ? texts[texts.length - 1] : "";

    if (!text) return json({ error: "Empty draft" }, 502);
    if (text === "NOTHING") {
      return json({ error: "no_usable_cue" }, 404);
    }

    return json({
      text,
      language,
      sources: used.length,
      notes_used: Math.min(pastNotes.length, 6),
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function stripPrefix(name: string | null): string {
  return (name ?? "").replace(/^\[[^\]]*\]\s*/, "").trim();
}

/** The prose of a note, without the structured Tempo / Load prefixes the
 *  editor writes into the same column. */
function proseOfNotes(notes: string | null): string {
  return (notes ?? "")
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && !/^(Tempo|Load)\s*:/i.test(p))
    .join(" · ");
}

function clip(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
