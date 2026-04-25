import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Require an auth token from the caller; only coaches may invite.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) return json(401, { error: "Missing auth token" });

    const { data: callerData, error: callerErr } = await admin.auth.getUser(
      callerToken
    );
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Invalid auth token" });
    }
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .single();
    if (callerProfile?.role !== "coach") {
      return json(403, { error: "Only coaches can invite clients" });
    }

    // Parse and validate body
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const first_name = (body.first_name ?? "").toString().trim();
    const program_id =
      body.program_id != null && body.program_id !== ""
        ? String(body.program_id)
        : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: "Valid email required" });
    }
    if (!first_name) {
      return json(400, { error: "First name required" });
    }

    // Refuse to hijack a program already assigned to someone else.
    if (program_id) {
      const { data: prog } = await admin
        .from("programs")
        .select("id, title, assigned_client_id, type")
        .eq("id", program_id)
        .single();
      if (!prog) return json(400, { error: "Program not found" });
      if (
        prog.assigned_client_id &&
        prog.assigned_client_id !== callerData.user.id
      ) {
        return json(400, {
          error: "This program is already assigned to another client",
        });
      }
    }

    // Generate the invite link. generateLink will create the auth user if it
    // does not exist yet; if it does, it falls back to a magic-link for the
    // existing account so we can still onboard them smoothly.
    const redirectTo = "https://www.ldmove.com/app/welcome";

    let action_link: string | null = null;
    let client_id: string | null = null;

    const { data: invite, error: inviteErr } =
      await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { first_name, last_name: "" },
          redirectTo,
        },
      });

    if (inviteErr) {
      // User already exists — issue a magic login link instead.
      const already =
        typeof inviteErr.message === "string" &&
        inviteErr.message.toLowerCase().includes("already");
      if (!already) {
        console.error("invite link error:", inviteErr);
        return json(500, { error: "Failed to create invite link" });
      }
      const { data: magic, error: magicErr } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });
      if (magicErr || !magic) {
        console.error("magic link error:", magicErr);
        return json(500, { error: "Failed to create login link" });
      }
      action_link = magic.properties.action_link;
      client_id = magic.user.id;
    } else {
      action_link = invite.properties.action_link;
      client_id = invite.user.id;
    }

    if (!action_link || !client_id) {
      return json(500, { error: "No link generated" });
    }

    // Make sure the profile row carries the first_name the coach typed.
    await admin
      .from("profiles")
      .upsert(
        { id: client_id, email, first_name, role: "client" },
        { onConflict: "id" }
      );

    // Optionally attach an existing program to this client.
    if (program_id) {
      await admin
        .from("programs")
        .update({ assigned_client_id: client_id })
        .eq("id", program_id);
    }

    // Send a branded invite email via Resend.
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const subject = `${first_name}, welcome to LD Move`;
      const text = `Hi ${first_name},

I've set up your personal LD Move training space. Click the link below to create your password and get started.

Activate my account: ${action_link}

Once you're in, there are two quick things to complete so I can build your first program:

  1. Fill the intake form (about 5 minutes)
  2. Film and send me your assessment videos (the instructions are on the site)

You'll see both as a banner after you create your password. Take your time.

If you have any question, just reply to this email.

See you soon,
Maxime
LD Move`;

      const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;background:#f6f4ef;padding:32px;color:#1f2937;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(first_name)},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px;">I've set up your personal LD Move training space. Click the button below to create your password and get started.</p>
    <p style="margin:28px 0;text-align:center;">
      <a href="${action_link}" style="background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px;display:inline-block;">Activate my account</a>
    </p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 10px;">Once you're in, two quick things to complete:</p>
      <ol style="font-size:14px;line-height:1.7;color:#374151;padding-left:18px;margin:0;">
        <li><strong>Fill the intake form</strong> (about 5 minutes), to help me understand where you are.</li>
        <li><strong>Film and send your assessment videos</strong>. The instructions are on the site.</li>
      </ol>
      <p style="font-size:13px;color:#6b7280;margin:12px 0 0;">You'll see both as a banner right after you create your password.</p>
    </div>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 8px;">If the button doesn't work, copy this link:</p>
    <p style="font-size:12px;color:#6b7280;word-break:break-all;margin:0 0 24px;">${action_link}</p>
    <p style="font-size:14px;line-height:1.6;margin:24px 0 0;color:#374151;">See you soon,<br/>Maxime · LD Move</p>
  </div>
</body></html>`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "LD Move <coach@ldmove.com>",
          to: [email],
          reply_to: "coach@ldmove.com",
          subject,
          text,
          html,
        }),
      });
      if (!resendRes.ok) {
        console.error("Resend error:", await resendRes.text());
      }
    } else {
      console.warn("RESEND_API_KEY missing — skipped invite email");
    }

    return json(200, { success: true, client_id });
  } catch (err) {
    console.error("invite-client error:", err);
    return json(500, { error: "Unexpected error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;"
  );
}
