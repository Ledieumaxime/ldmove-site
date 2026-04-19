// Creates a Stripe Checkout Session for a given program_id.
// Authenticated client only.
// deno-lint-ignore-file no-explicit-any

import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:8080";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Identify the calling user via the access_token
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) return json({ error: "Invalid token" }, 401);
    const user = userRes.user;

    const { program_id } = await req.json();
    if (!program_id) return json({ error: "program_id required" }, 400);

    // Fetch the program (bypass RLS via service role)
    const { data: program, error: progErr } = await admin
      .from("programs")
      .select("*")
      .eq("id", program_id)
      .maybeSingle();
    if (progErr || !program) return json({ error: "Program not found" }, 404);

    // Make sure the user can access this program
    if (program.type === "custom" && program.assigned_client_id !== user.id) {
      return json({ error: "This program is not assigned to you" }, 403);
    }

    // Upsert a pending enrollment
    let enrollmentId: string;
    {
      const { data: existing } = await admin
        .from("enrollments")
        .select("id, status")
        .eq("program_id", program.id)
        .eq("client_id", user.id)
        .maybeSingle();
      if (existing && (existing.status === "paid" || existing.status === "active")) {
        return json({ error: "Already paid" }, 400);
      }
      if (existing) {
        enrollmentId = existing.id;
      } else {
        const { data: inserted, error: insErr } = await admin
          .from("enrollments")
          .insert({ program_id: program.id, client_id: user.id, status: "pending" })
          .select("id")
          .single();
        if (insErr || !inserted) return json({ error: "Enrollment failed" }, 500);
        enrollmentId = inserted.id;
      }
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

    const isSubscription = program.billing_type === "subscription";

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      customer_email: user.email ?? undefined,
      client_reference_id: enrollmentId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(program.price_eur) * 100),
            product_data: {
              name: program.title,
              description: program.description ?? undefined,
            },
            ...(isSubscription
              ? { recurring: { interval: "month" } }
              : {}),
          },
        },
      ],
      success_url: `${siteUrl}/app/checkout-success?enrollment=${enrollmentId}`,
      cancel_url: `${siteUrl}/app/programs/${program.slug}`,
      metadata: {
        enrollment_id: enrollmentId,
        program_id: program.id,
        client_id: user.id,
      },
    });

    // Store the session id on the enrollment
    await admin
      .from("enrollments")
      .update({ stripe_session_id: session.id })
      .eq("id", enrollmentId);

    return json({ url: session.url }, 200);
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
