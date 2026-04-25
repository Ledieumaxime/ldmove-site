// Notify a client by email that a new program has been published for them.
// Authenticated coach only.
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
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const fromAddress = Deno.env.get("RESEND_FROM") ?? "LD Move <onboarding@resend.dev>";
    const replyTo = Deno.env.get("RESEND_REPLY_TO");
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:8080";

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Only a coach can trigger
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

    // Fetch program + client
    const { data: program } = await admin
      .from("programs")
      .select("id, slug, title, description, assigned_client_id, type")
      .eq("id", program_id)
      .maybeSingle();
    if (!program) return json({ error: "Program not found" }, 404);
    if (!program.assigned_client_id) return json({ error: "Program has no assigned client" }, 400);

    const { data: client } = await admin
      .from("profiles")
      .select("id, email, first_name")
      .eq("id", program.assigned_client_id)
      .maybeSingle();
    if (!client?.email) return json({ error: "Client has no email" }, 400);

    const firstName = client.first_name ?? "there";
    const programUrl = `${siteUrl}/app/programs/${program.slug}`;

    const subject = `Your new program is ready, ${firstName} 👋`;
    const html = renderEmail({
      firstName,
      programTitle: program.title,
      programDescription: program.description ?? "",
      programUrl,
      loginUrl: `${siteUrl}/app/login`,
    });
    const text = `Hey ${firstName},\n\nYour new program "${program.title}" is live.\n\nOpen it: ${programUrl}\n\nTalk soon,\nMaxime, LD Move`;

    // Send via Resend
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [client.email],
        reply_to: replyTo ? [replyTo] : undefined,
        subject,
        html,
        text,
      }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      return json({ error: `Resend: ${err}` }, 500);
    }

    // Also create an in-app notification
    await admin.from("notifications").insert({
      user_id: client.id,
      type: "program_published",
      title: `New program: ${program.title}`,
      body: `${firstName}, your program "${program.title}" is ready to start.`,
      link_url: `/app/programs/${program.slug}`,
    });

    return json({ ok: true }, 200);
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

function renderEmail(v: {
  firstName: string;
  programTitle: string;
  programDescription: string;
  programUrl: string;
  loginUrl: string;
}) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;background:#f5f0e8;color:#3a3530;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);" cellpadding="0" cellspacing="0">
        <tr><td style="padding:40px 32px 0 32px;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#e07830;font-weight:600;">LD Move</p>
          <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;line-height:1.3;color:#3a3530;">
            Hey ${escapeHtml(v.firstName)}, your new program is live
          </h1>
          <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#5a4a3a;">
            I just published <strong>${escapeHtml(v.programTitle)}</strong> for you.
          </p>
          ${v.programDescription ? `<p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#8a7e72;">${escapeHtml(v.programDescription)}</p>` : ""}
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#e07830;border-radius:999px;">
            <a href="${v.programUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px;">Open the program →</a>
          </td></tr></table>
          <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#8a7e72;">
            If you're not signed in, <a href="${v.loginUrl}" style="color:#e07830;">log in here</a> first.
          </p>
        </td></tr>
        <tr><td style="padding:32px;border-top:1px solid #ede8e0;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#8a7e72;line-height:1.5;">
            Training well this week?<br/>
            Reply to this email. It goes straight to me.<br/><br/>
            Maxime
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:11px;color:#a09890;">LD Move · Online Coaching</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
