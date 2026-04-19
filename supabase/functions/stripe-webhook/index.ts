// Stripe webhook: marks enrollment as paid when a checkout session completes
// or when a subscription invoice is paid.
// deno-lint-ignore-file no-explicit-any

import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const enrollmentId = session.metadata?.enrollment_id ?? session.client_reference_id;
        const isSubscription = session.mode === "subscription";
        if (enrollmentId) {
          const patch: Record<string, unknown> = {
            status: isSubscription ? "active" : "paid",
            started_at: new Date().toISOString(),
          };
          if (isSubscription && session.subscription) {
            patch.stripe_subscription_id = session.subscription;
          }
          await admin.from("enrollments").update(patch).eq("id", enrollmentId);
          console.log("Enrollment marked paid:", enrollmentId);
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await admin
            .from("enrollments")
            .update({ status: "active" })
            .eq("stripe_subscription_id", invoice.subscription);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from("enrollments")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(`Handler error: ${e.message}`, { status: 500 });
  }
});
