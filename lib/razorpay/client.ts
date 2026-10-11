import "server-only";
import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils";

/**
 * Server-only Razorpay SDK instance.
 *
 * `import "server-only"` guarantees a build-time failure if this is ever
 * imported from a client component, so RAZORPAY_KEY_SECRET can never end up
 * in the browser bundle - same pattern as lib/supabase/admin.ts.
 *
 * Only NEXT_PUBLIC_RAZORPAY_KEY_ID (the public key, needed by the browser to
 * open Razorpay Checkout) is ever exposed client-side; everything here stays
 * server-side.
 */
export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local."
    );
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Verifies the signature Razorpay Checkout returns to the browser on
 * successful payment (HMAC-SHA256 of `order_id|payment_id`, keyed with the
 * account's key secret - NOT the webhook secret, a different key/scheme).
 * This is the SDK's own implementation, not a hand-rolled HMAC - see
 * node_modules/razorpay/dist/utils/razorpay-utils.js.
 *
 * A true result here is real proof of payment (only Razorpay could have
 * produced a signature that verifies with our secret key), so it's safe to
 * finalize the order from this path - but the webhook (verifyRazorpayWebhookSignature)
 * remains the durable backstop for when the browser never returns at all
 * (closed tab, crashed redirect, etc.).
 */
export function verifyRazorpayCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;

  return validatePaymentVerification(
    { order_id: params.razorpayOrderId, payment_id: params.razorpayPaymentId },
    params.razorpaySignature,
    keySecret
  );
}

/**
 * Verifies an incoming webhook request's signature (HMAC-SHA256 of the raw
 * request body, keyed with the separate RAZORPAY_WEBHOOK_SECRET configured
 * in the Razorpay dashboard - not the same secret as above). `rawBody` MUST
 * be the exact, unparsed request text: re-serializing parsed JSON before
 * verifying is a common bug that breaks verification, since key order/
 * whitespace can differ byte-for-byte from what Razorpay actually sent and
 * signed.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  return Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret);
}