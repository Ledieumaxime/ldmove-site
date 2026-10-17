// Permanently delete a client and every trace of them.
//
// Two callers:
//  - the coach, deleting any client from the client page;
//  - a client deleting their OWN account from Profile in the app. Apple
//    requires account deletion to start inside the app (guideline
//    5.1.1(v)); until now it took an email to the coach. A client can
//    only ever name themselves, whatever the request says.
//
// Wipes:
//  - storage: form-checks/, assessment-videos/ and comment-images/
//    <client_id>/*. Comment images are filed under the CLIENT of the
//    thread whoever posted them, so this also takes the coach's pictures
//    of that client.
//  - custom programs assigned to the client (cascades to weeks → items
//    → exercise_comments / form_check_submissions DB rows)
//  - any exercise_comments authored by the client on other programs
//    (the FK is SET NULL by default, which leaves anonymous traces)
//  - their coaching application(s), matched on email: name, phone and
//    message would otherwise outlive the account
//  - the auth user, which cascades to profile and every CASCADE-linked
//    table (workout_logs, client_intakes, assessment_videos rows,
//    notifications, comment_reads, push_tokens, …)
//
// Catalogue programs and any data tied to other clients stay
// untouched. Never deletes a coach. When a client deletes themselves,
// the coach gets an email, so a client does not just vanish from the list.
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

    // 1. Who is asking.
    const { data: userRes } = await admin.auth.getUser(token);
    if (!userRes?.user) return json({ error: "Invalid token" }, 401);
    const callerId = userRes.user.id;

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();
    const selfService = callerProfile?.role === "client";
    if (callerProfile?.role !== "coach" && !selfService)
      return json({ error: "Not allowed" }, 403);

    // 2. Read and validate the target.
    const body = await req.json().catch(() => ({}));
    const requested: unknown = body?.client_id;
    let client_id: string;
    if (selfService) {
      if (requested && requested !== callerId)
        return json({ error: "You can only delete your own account" }, 403);
      client_id = callerId;
    } else {
      if (!requested || typeof requested !== "string")
        return json({ error: "client_id required" }, 400);
      if (requested === callerId)
        return json({ error: "You can't delete yourself" }, 400);
      client_id = requested;
    }

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
      comment_image_files_deleted: 0,
      applications_deleted: 0,
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
    summary.comment_image_files_deleted = await wipeUserFolder(
      admin,
      "comment-images",
      client_id
    );

    // 6. The application they sent before becoming a client. Matched
    //    case-insensitively, with LIKE's wildcards escaped: "_" is common
    //    in addresses and would otherwise match any character, and
    //    delete someone else's application.
    if (targetProfile.email) {
      const exact = targetProfile.email.replace(/[\\%_]/g, (c: string) => `\\${c}`);
      const { error: appErr, count: appCount } = await admin
        .from("coaching_applications")
        .delete({ count: "exact" })
        .ilike("email", exact);
      if (appErr) throw appErr;
      summary.applications_deleted = appCount ?? 0;
    }

    // 7. Finally, delete the auth user. The auth.users → profiles
    //    cascade does the rest (workout_logs, intake, etc.).
    const { error: authErr } = await admin.auth.admin.deleteUser(client_id);
    if (authErr) throw authErr;

    // 8. Tell the coach when the client did it themselves. Best effort:
    //    the account is already gone, a failed email must not report the
    //    deletion as failed.
    if (selfService) {
      await tellCoach(targetProfile).catch((e) =>
        console.error("delete-client: coach email failed", e)
      );
    }

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

async function tellCoach(client: {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const name =
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.email ||
    "A client";
  const text =
    `${name}${client.email ? ` (${client.email})` : ""} deleted their LD Move account from the app.\n\n` +
    `Their programs, logged sets, comments, form-check videos and intake are gone. ` +
    `They no longer appear in your client list.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") ?? "LD Move <coach@ldmove.com>",
      to: ["coach@ldmove.com"],
      subject: `${name} deleted their account`,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
