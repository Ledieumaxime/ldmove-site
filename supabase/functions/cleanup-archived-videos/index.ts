// When a program is archived, delete all form-check video files attached to
// exercises in that program. Keeps the DB rows (notes + feedback stay as history).
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Coach-only
    const { data: userRes } = await admin.auth.getUser(token);
    if (!userRes?.user) return json({ error: "Invalid token" }, 401);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (profile?.role !== "coach") return json({ error: "Coach only" }, 403);

    const { program_id } = await req.json();
    if (!program_id) return json({ error: "program_id required" }, 400);

    // 1. Get all program_items IDs for this program (via weeks)
    const { data: weeks } = await admin
      .from("program_weeks")
      .select("id")
      .eq("program_id", program_id);
    const weekIds = (weeks ?? []).map((w: any) => w.id);
    if (weekIds.length === 0) return json({ ok: true, deleted: 0 }, 200);

    const { data: items } = await admin
      .from("program_items")
      .select("id")
      .in("week_id", weekIds);
    const itemIds = (items ?? []).map((i: any) => i.id);
    if (itemIds.length === 0) return json({ ok: true, deleted: 0 }, 200);

    // 2. Find all form_check_submissions with a video_url for these items
    const { data: submissions } = await admin
      .from("form_check_submissions")
      .select("id, video_url")
      .in("item_id", itemIds)
      .not("video_url", "is", null);

    let deleted = 0;
    const pathsToRemove: string[] = [];
    const subIds: string[] = [];
    for (const s of submissions ?? []) {
      if (s.video_url) {
        pathsToRemove.push(s.video_url);
        subIds.push(s.id);
      }
    }

    // 3. Delete files from storage (bulk)
    if (pathsToRemove.length > 0) {
      const { error: rmErr } = await admin.storage
        .from("form-checks")
        .remove(pathsToRemove);
      if (rmErr) console.error("storage remove error", rmErr);
      else deleted = pathsToRemove.length;
    }

    // 4. Set video_url = null on affected rows (keep the feedback/notes for history)
    if (subIds.length > 0) {
      await admin
        .from("form_check_submissions")
        .update({ video_url: null })
        .in("id", subIds);
    }

    return json({ ok: true, deleted }, 200);
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
