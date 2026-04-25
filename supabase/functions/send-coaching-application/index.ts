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
    const body = await req.json();
    const { first_name, last_name, email, phone, country, goal, level, duration, message } = body;

    // Validate required fields
    if (!first_name || !last_name || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase.from("coaching_applications").insert({
      first_name: first_name.trim().slice(0, 200),
      last_name: last_name.trim().slice(0, 200),
      email: email.trim().slice(0, 255),
      phone: phone ? phone.trim().slice(0, 30) : "",
      country: country ? country.trim().slice(0, 200) : "",
      goal: goal || null,
      level: level || "contact",
      duration: duration || null,
      message: message ? message.trim().slice(0, 2000) : null,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if this is a coaching application or general contact
    const isCoachingApp = !!goal || !!level && level !== "contact";
    const subjectPrefix = isCoachingApp ? "New coaching application" : "New contact message";

    // Send email notification if Resend API key is configured
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        let emailBody = `
${subjectPrefix}

Name: ${first_name} ${last_name}
Email: ${email}
Phone/WhatsApp: ${phone || "Not provided"}
Country: ${country || "Not provided"}`;

        if (isCoachingApp) {
          emailBody += `
Goal: ${goal || "Not specified"}
Level: ${level || "Not specified"}
Duration: ${duration || "Not specified"}`;
        }

        if (message) {
          emailBody += `

Message:
${message}`;
        }

        emailBody += `

Received at: ${new Date().toISOString()}`;

        const FROM_ADDRESS = "LD Move <coach@ldmove.com>";

        // 1. Notify the coach
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: ["coach@ldmove.com"],
            reply_to: email,
            subject: `${subjectPrefix} from ${first_name} ${last_name}`,
            text: emailBody.trim(),
          }),
        });

        if (!res.ok) {
          console.error("Email send failed:", await res.text());
        }

        // 2. Auto-confirmation to the prospect so they know the message went through
        const confirmationSubject = isCoachingApp
          ? "Thanks for your application, LD Move"
          : "Thanks for your message, LD Move";
        const confirmationBody = `Hi ${first_name},

Thanks for reaching out to LD Move. I've received your ${isCoachingApp ? "coaching application" : "message"} and will get back to you within 48 hours.

If anything urgent comes up in the meantime, you can reply to this email directly.

Talk soon,
Maxime
LD Move`;

        const confRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [email],
            reply_to: "coach@ldmove.com",
            subject: confirmationSubject,
            text: confirmationBody,
          }),
        });

        if (!confRes.ok) {
          // Expected to fail for non-owner addresses until ldmove.com is verified
          // on Resend. Log but do not disrupt the flow — the coach still gets the
          // notification and can reach out manually.
          console.warn("Prospect confirmation not sent:", await confRes.text());
        }
      } catch (emailErr) {
        console.error("Email notification error:", emailErr);
      }
    } else {
      console.log("RESEND_API_KEY not configured — skipping email notification");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
