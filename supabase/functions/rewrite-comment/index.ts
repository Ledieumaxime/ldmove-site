// Rewrite a coach's draft feedback in the client's language.
//
// Maxime coaches in English but thinks in French, so his comments carry
// French-speaker slips ("Exemple", "let's said", "witch control",
// "pressure un your knuckle"). He writes whatever comes out, this
// returns clean prose in the language that client actually reads.
//
// It does NOT invent coaching. The model never sees the video and has
// no business judging a handstand: it rewrites what the coach already
// said and nothing more. Anything that looks like added instruction
// would be a bug, so the prompt forbids it explicitly.
//
// Style comes from the coach's own past comments, passed as examples,
// so the output keeps his vocabulary (compression, elevation, scapula)
// and his short, direct tone instead of textbook English.
//
// Coach only. The key lives in Supabase secrets, never in the bundle:
// a VITE_ variable would ship to every visitor's browser.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Opus: this text goes straight to a paying client, in two languages,
// and the whole feature costs about 60 cents a month at the coach's
// volume of ~63 comments. Quality decides, not price.
const MODEL = "claude-opus-5";
/** Enough past comments to carry a voice, few enough to stay cheap. */
const STYLE_SAMPLE = 25;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "AI key not configured" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace(
      "Bearer ",
      ""
    );
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

    const { draft, client_id } = await req.json();
    if (!draft || typeof draft !== "string" || !draft.trim()) {
      return json({ error: "draft required" }, 400);
    }
    if (draft.length > 4000) return json({ error: "draft too long" }, 400);

    // Who is this for, and in what language do they read?
    let language = "en";
    if (client_id) {
      const { data: client } = await admin
        .from("profiles")
        .select("language")
        .eq("id", client_id)
        .maybeSingle();
      if (client?.language === "fr") language = "fr";
    }

    // The coach's own voice, taken from what he already sent in that
    // language. Long enough to show style, short enough to skip the
    // "ok" / "nice" one-liners that teach nothing.
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
      .filter((b: string) => b.length > 40 && b.length < 400)
      .filter((b: string) => (language === "fr" ? isFrench(b) : !isFrench(b)))
      .slice(0, STYLE_SAMPLE);

    const target = language === "fr" ? "French" : "English";
    const system = [
      `You clean up a strength coach's written feedback to one of his clients.`,
      `He is French and coaches in ${target}. His draft may be in French, in ${target}, or a mix of both.`,
      ``,
      `The field is handstand, planche, front lever, straight-arm strength and`,
      `mobility. You know this vocabulary, and you are expected to use the`,
      `precise term rather than the literal translation. "Élever les épaules"`,
      `is scapular elevation, not "raise the shoulders". Choosing the exact`,
      `term is not adding content, it is saying the same thing correctly.`,
      ``,
      `His own vocabulary, by frequency across 227 messages: shoulder,`,
      `compression, hip, scapula, protraction, elevation, posterior tilt,`,
      `retraction, external rotation, hollow, arch, tuck, pike, straddle,`,
      `lock the elbows, lats, glutes, wrist, knuckles. Prefer these words.`,
      ``,
      `Common shifts, French to English:`,
      `  élever / élévation des épaules  ->  scapular elevation`,
      `  abaisser les épaules            ->  scapular depression`,
      `  serrer les omoplates            ->  scapular retraction`,
      `  écarter / pousser les omoplates ->  protraction`,
      `  ouvrir les épaules              ->  open the shoulders`,
      `  rétroversion (du bassin)        ->  posterior pelvic tilt`,
      `  antéversion (du bassin)         ->  anterior pelvic tilt`,
      `  gainage                         ->  brace the core`,
      `  creux / dos rond volontaire     ->  hollow`,
      `  cambrer                         ->  arch`,
      `  verrouiller les coudes          ->  lock the elbows`,
      `  rotation externe / interne      ->  external / internal rotation`,
      `  ischios / fessiers / adducteurs ->  hamstrings / glutes / adductors`,
      `  écart facial                    ->  middle split`,
      `  montée en force                 ->  press to handstand`,
      `  équilibre                       ->  handstand (or balance, in context)`,
      `Going the other way, into French, use the terms a French athlete says:`,
      `posterior tilt stays "rétroversion", protraction stays "protraction".`,
      ``,
      `Return the same message in natural ${target}, correcting spelling, grammar and word choice.`,
      ``,
      `Rules, in order of importance:`,
      `1. Never add coaching content. No cue, no rep count, no body part he did not mention. You have not seen the video and cannot know what to correct. Naming a joint he clearly meant is terminology; telling him to also watch the elbows is invention.`,
      `2. Never remove a technical instruction he gave, even if it seems odd.`,
      `3. The WHOLE message must be in ${target}. Not one word, greeting or closing may stay in the other language. "Good work" in a French message is a bug, not style.`,
      `4. Keep his length. A six-word note stays a six-word note; do not pad it into a paragraph.`,
      `5. Keep his voice: direct, warm, second person, no corporate politeness.`,
      `6. Keep numbers, units and equipment exactly as written. Exercise names stay in English in both languages: that is what the app displays and what the client sees on their program.`,
      ``,
      `Reply with the rewritten message alone. No preamble, no quotes, no explanation.`,
      ``,
      `Never show the original alongside the rewrite, and never gloss it. A short`,
      `draft is a complete message, not a fragment to be annotated:`,
      `  "c'est mieux"           ->  "That's better."      NOT  "C'est mieux — that's better."`,
      `  "top c'est bien mieux"  ->  "That's much better."  NOT  "Top, that's much better."`,
      `Three words in, three words out, in ${target} only.`,
    ].join("\n");

    const styleBlock = examples.length
      ? `Here are messages he has already sent, as a reference for tone and vocabulary. Do not copy their content:\n\n${examples
          .map((e: string) => `- ${e}`)
          .join("\n")}\n\n`
      : "";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system,
        messages: [
          {
            role: "user",
            content: `${styleBlock}Draft to rewrite in ${target}:\n\n${draft.trim()}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("anthropic error", res.status, detail);
      return json({ error: "The assistant is unavailable right now" }, 502);
    }

    const data = await res.json();
    // The LAST text block, not all of them joined. A reply can arrive as
    // several blocks when the model works through the rewrite before
    // settling on it, and concatenating them shipped its scratch work:
    // `C'est mieux → "That's better"That's better`. The answer is the
    // final block; anything before it is the model thinking out loud.
    const texts = (data?.content ?? [])
      .filter((c: any) => c.type === "text" && typeof c.text === "string")
      .map((c: any) => c.text.trim())
      .filter(Boolean);
    const text = texts.length ? texts[texts.length - 1] : "";

    if (!text) return json({ error: "Empty rewrite" }, 502);

    return json({ text, language, examples_used: examples.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
