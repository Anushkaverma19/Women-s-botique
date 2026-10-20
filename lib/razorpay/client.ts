import "server-only";
import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Server-only Razorpay SDK instance.
 *
 * `import "server-only"` guarantees a build-time failure if this is ever
 * imported from a client component, so RAZORPAY_KEY_SECRET can never end up
 * in the browser bundle - same pattern as lib/supabase/admin.ts.
 *
 * Checks both RAZORPAY_KEY_ID (recommended server env var) and
 * NEXT_PUBLIC_RAZORPAY_KEY_ID (convenience fallback if set in .env.local).
 */
export function getRazorpayClient() {
  const keyId =
    process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID (or NEXT_PUBLIC_RAZORPAY_KEY_ID) and RAZORPAY_KEY_SECRET in .env.local."
    );
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Constant-time string comparison using crypto.timingSafeEqual
 * to prevent HMAC timing side-channel attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the signature Razorpay Checkout returns to the browser on
 * successful payment (HMAC-SHA256 of `order_id|payment_id`, keyed with key secret).
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyRazorpayCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (
    !keySecret ||
    !params.razorpayOrderId ||
    !params.razorpayPaymentId ||
    !params.razorpaySignature
  ) {
    return false;
  }

  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  return constantTimeCompare(expectedSignature, params.razorpaySignature);
}

/**
 * Verifies an incoming webhook request's signature (HMAC-SHA256 of the raw
 * request body, keyed with RAZORPAY_WEBHOOK_SECRET). `rawBody` MUST
 * be the exact, unparsed request text.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !rawBody || !signature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  return constantTimeCompare(expectedSignature, signature);
}