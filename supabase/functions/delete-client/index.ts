// Permanently delete a client and every trace of them.
//
// Coach-only. Wipes:
//  - storage: form-checks/<client_id>/* and assessment-videos/<client_id>/*
//  - custom programs assigned to the client (cascades to weeks → items
//    → exercise_comments / form_check_submissions DB rows)
//  - any exercise_comments authored by the client on other programs
//    (the FK is SET NULL by default, which leaves anonymous traces)
//  - the auth user, which cascades to profile and every CASCADE-linked
//    table (workout_logs, client_intakes, assessment_videos rows,
//    notifications, comment_reads, …)
//
// Catalogue programs and any data tied to other clients stay
// untouched. Refuses to delete coaches or yourself.
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Verify the caller is a coach.
    const { data: userRes } = await admin.auth.getUser(token);
    if (!userRes?.user) return json({ error: "Invalid token" }, 401);
    const callerId = userRes.user.id;

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();
    if (callerProfile?.role !== "coach")
      return json({ error: "Coach only" }, 403);

    // 2. Read and validate the target.
    const { client_id } = await req.json();
    if (!client_id || typeof client_id !== "string")
      return json({ error: "client_id required" }, 400);
    if (client_id === callerId)
      return json({ error: "You can't delete yourself" }, 400);

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, role, email, first_name, last_name")
      .eq("id", client_id)
      .maybeSingle();
    if (!targetProfile)
      return json({ error: "Client not found" }, 404);
    if (targetProfile.role !== "client")
      return json(
        { error: "Refusing to delete a non-client account" },
        400
      );

    const summary: Record<string, number> = {
      programs_deleted: 0,
      orphan_comments_deleted: 0,
      form_check_files_deleted: 0,
      assessment_files_deleted: 0,
    };

    // 3. Delete custom programs assigned to this client. Cascades
    //    handle program_weeks → program_items → exercise_comments
    //    and form_check_submissions DB rows.
    const { data: clientPrograms } = await admin
      .from("programs")
      .select("id")
      .eq("type", "custom")
      .eq("assigned_client_id", client_id);
    const programIds = (clientPrograms ?? []).map((p: any) => p.id);
    if (programIds.length > 0) {
      const { error: progErr } = await admin
        .from("programs")
        .delete()
        .in("id", programIds);
      if (progErr) throw progErr;
      summary.programs_deleted = programIds.length;
    }

    // 4. Wipe any leftover comments authored by the client on other
    //    programs. Without this they'd survive with author_id=NULL
    //    (the column's FK is SET NULL).
    const { error: commentErr, count: commentCount } = await admin
      .from("exercise_comments")
      .delete({ count: "exact" })
      .eq("author_id", client_id);
    if (commentErr) throw commentErr;
    summary.orphan_comments_deleted = commentCount ?? 0;

    // 5. Storage cleanup. List + remove every file under the user's
    //    folder in each bucket. Use a tight loop so we don't OOM on
    //    edge — Supabase paginates lists, default 100 entries.
    summary.form_check_files_deleted = await wipeUserFolder(
      admin,
      "form-checks",
      client_id
    );
    summary.assessment_files_deleted = await wipeUserFolder(
      admin,
      "assessment-videos",
      client_id
    );

    // 6. Finally, delete the auth user. The auth.users → profiles
    //    cascade does the rest (workout_logs, intake, etc.).
    const { error: authErr } = await admin.auth.admin.deleteUser(client_id);
    if (authErr) throw authErr;

    return json({ ok: true, ...summary }, 200);
  } catch (e: any) {
    console.error("delete-client error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

async function wipeUserFolder(
  admin: any,
  bucket: string,
  userId: string
): Promise<number> {
  let total = 0;
  // Loop through pages until no more files come back.
  while (true) {
    const { data: files, error } = await admin.storage
      .from(bucket)
      .list(userId, { limit: 1000 });
    if (error) {
      console.error(`list ${bucket}/${userId}`, error);
      break;
    }
    if (!files || files.length === 0) break;
    const paths = files.map((f: any) => `${userId}/${f.name}`);
    const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
    if (rmErr) {
      console.error(`remove ${bucket}`, rmErr);
      break;
    }
    total += paths.length;
    if (files.length < 1000) break;
  }
  return total;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
