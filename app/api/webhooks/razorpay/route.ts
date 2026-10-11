import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/client";

// Razorpay's own retry behaviour is what makes this endpoint reliable, not
// anything clever in our code: on any non-2xx response it retries with
// backoff for a while. So the status codes returned here are deliberate,
// not incidental:
//   - 200: either genuinely processed, or a case we understand and know a
//     retry can never fix (bad signature, event type we don't act on).
//     Returning 200 here tells Razorpay "stop retrying".
//   - 404/500: a case where a retry might actually help (see the
//     order-not-found race explained below, or a transient DB error) - lets
//     Razorpay's retry schedule paper over it.
//
// No per-IP rate limiting is applied to this route (unlike the rest of
// /api/*, see proxy.ts): Razorpay's retries come from Razorpay's own
// servers, and rate-limiting them could silently drop a legitimate payment
// confirmation.

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
      };
    };
  };
}

export async function POST(request: Request) {
  // MUST read the raw text for signature verification - request.json() and
  // re-serializing would not byte-for-byte match what Razorpay actually
  // signed, silently breaking verification. See lib/razorpay/client.ts.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    console.error("Razorpay webhook: invalid or missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    // Signature was valid but the body isn't JSON - can't be a real
    // Razorpay payload (they always send JSON when the signature matches),
    // and no retry will fix malformed JSON. Acknowledge and drop it.
    console.error("Razorpay webhook: signature valid but body is not JSON");
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  try {
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const razorpayOrderId =
        event.payload.payment?.entity?.order_id ?? event.payload.order?.entity?.id;
      const razorpayPaymentId = event.payload.payment?.entity?.id ?? "";

      if (!razorpayOrderId) {
        console.error("Razorpay webhook: success event missing order id", event.event);
        return NextResponse.json({ received: true }); // nothing to act on, no retry helps
      }

      const { data: order } = await admin
        .from("orders")
        .select("id")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();

      if (!order) {
        // The order might not exist YET: create_razorpay_order() runs, then
        // we call Razorpay's API, then we write razorpay_order_id back onto
        // the order - if this webhook somehow arrives in that narrow window,
        // failing with a retryable status gives that write time to land,
        // instead of silently dropping a real, paid order.
        console.error("Razorpay webhook: no matching order yet for", razorpayOrderId);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const { error } = await admin.rpc("finalize_razorpay_order", {
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
      });

      if (error) {
        console.error("Razorpay webhook: finalize_razorpay_order failed", error);
        return NextResponse.json({ error: "Could not finalize order" }, { status: 500 });
      }

      // Idempotent by construction (see migration): whether this is the
      // first delivery or a duplicate retry, the outcome is the same order
      // in the same 'paid' state.
      return NextResponse.json({ received: true });
    }

    if (event.event === "payment.failed") {
      const razorpayOrderId = event.payload.payment?.entity?.order_id;
      if (!razorpayOrderId) {
        return NextResponse.json({ received: true });
      }

      const { error } = await admin.rpc("fail_razorpay_order", {
        p_razorpay_order_id: razorpayOrderId,
      });

      if (error) {
        // ORDER_NOT_FOUND lands here too - same reasoning as the success
        // path: give it a retryable status rather than assuming it will
        // never resolve.
        console.error("Razorpay webhook: fail_razorpay_order failed", error);
        return NextResponse.json({ error: "Could not process failure" }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

    // Any other event type (refunds, disputes, etc.) - not handled by this
    // integration yet. Acknowledge so Razorpay doesn't retry something we
    // deliberately don't act on.
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Razorpay webhook: unexpected error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}