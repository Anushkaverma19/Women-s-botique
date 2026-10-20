"use server";

import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCartSummary } from "@/lib/cart/queries";
import { razorpayOrderSchema, razorpayVerifySchema } from "@/lib/validations/schemas";
import { getRazorpayClient, verifyRazorpayCheckoutSignature } from "@/lib/razorpay/client";

const FLAT_SHIPPING = 149;
const FREE_SHIPPING_THRESHOLD = 5000;

// Same RPC-error-code -> friendly-message mapping already used by the
// simulated /api/checkout route, so behaviour is consistent between both
// checkout paths for any shopper-facing error.
const RPC_ERROR_MESSAGES: Record<string, string> = {
  EMPTY_CART: "Your bag is empty.",
  VARIANT_UNAVAILABLE: "One of the items in your bag is no longer available.",
  INSUFFICIENT_STOCK: "One of the items in your bag just sold out. Please review your bag.",
  INVALID_COUPON: "That coupon code isn't valid.",
  COUPON_EXPIRED: "That coupon has expired.",
  MINIMUM_NOT_MET: "Your bag doesn't meet the minimum for this coupon.",
};

function friendlyRpcError(message: string): string {
  const code = message.split(":")[0].trim();
  return RPC_ERROR_MESSAGES[code] ?? "We couldn't place this order. Please try again.";
}

export interface CreateRazorpayOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry?: string;
  couponCode?: string;
}

export interface CreateRazorpayOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
}

/**
 * Step 1 of the Razorpay flow: reserve stock, create a 'pending' order in
 * our own DB (source of truth for pricing/inventory), then ask Razorpay to
 * create a matching order for that exact server-computed total. Returns
 * only what the browser needs to open Razorpay Checkout - never the key
 * secret.
 *
 * The total is never taken from the client: it's recomputed here from the
 * user's actual server-side cart (getCartSummary) and the coupon/shipping
 * rules, exactly like the existing simulated /api/checkout route does.
 */
export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput
): Promise<CreateRazorpayOrderResult> {
  const profile = await requireUser();
  const parsed = razorpayOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { items, subtotal } = await getCartSummary(profile.id);
  if (items.length === 0) {
    return { ok: false, error: "Your bag is empty." };
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  const rpcItems = items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
  }));

  const { data: order, error } = await supabase.rpc("create_razorpay_order", {
    p_user_id: profile.id,
    p_items: rpcItems,
    p_coupon_code: parsed.data.couponCode || null,
    p_shipping: shipping,
    p_customer_name: parsed.data.customerName,
    p_customer_email: parsed.data.customerEmail,
    p_customer_phone: parsed.data.customerPhone,
    p_shipping_address: parsed.data.shippingAddress,
    p_shipping_city: parsed.data.shippingCity,
    p_shipping_state: parsed.data.shippingState,
    p_shipping_postal_code: parsed.data.shippingPostalCode,
    p_shipping_country: parsed.data.shippingCountry || "India",
  });

  if (error || !order) {
    return { ok: false, error: friendlyRpcError(error?.message ?? "") };
  }

  // Stock is already reserved and the order already exists at this point -
  // if anything below fails, the order is left 'pending' with stock held.
  // release_stale_razorpay_orders (see migration) is the intended cleanup
  // for a shopper who never returns; a retried checkout on this same cart
  // simply creates a separate reservation.
  try {
    const razorpay = getRazorpayClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.total * 100), // Razorpay wants paise, not rupees
      currency: "INR",
      receipt: order.order_number,
      notes: { mehrae_order_id: order.id },
    });

    const admin = createAdminClient();
    await admin
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq("id", order.id);

    return {
      ok: true,
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: Number(razorpayOrder.amount),
      currency: razorpayOrder.currency,
      keyId:
        process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    };
  } catch (err) {
    console.error("Razorpay order creation failed after stock was reserved:", err);
    // Release reserved inventory immediately so stock isn't locked if gateway call failed
    try {
      const admin = createAdminClient();
      await admin
        .from("orders")
        .update({ razorpay_order_id: `failed_${order.id}` })
        .eq("id", order.id);
      await admin.rpc("fail_razorpay_order", {
        p_razorpay_order_id: `failed_${order.id}`,
      });
    } catch (cleanupErr) {
      console.error("Failed to release reserved stock after Razorpay error:", cleanupErr);
    }
    return {
      ok: false,
      error: "We couldn't connect to the payment gateway. Please try again in a moment.",
    };
  }
}

export interface VerifyRazorpayPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyRazorpayPaymentResult {
  ok: boolean;
  error?: string;
  orderId?: string;
}

/**
 * Step 2 (fast path): called from the browser's Razorpay Checkout success
 * handler. Verifies the signature Razorpay returned - cryptographic proof
 * the payment is genuine, since only Razorpay could produce a signature
 * that validates with our key secret - then finalizes the order via the
 * same idempotent RPC the webhook uses.
 *
 * This is a UX optimization for immediate redirect, NOT a replacement for
 * the webhook: if the browser never calls this at all (tab closed, network
 * drop right after payment), the webhook (app/api/webhooks/razorpay/route.ts)
 * is what actually finalizes the order. Whichever arrives first wins; the
 * second is a safe no-op (finalize_razorpay_order is idempotent).
 */
export async function verifyRazorpayPayment(
  input: VerifyRazorpayPaymentInput
): Promise<VerifyRazorpayPaymentResult> {
  const profile = await requireUser();
  const parsed = razorpayVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid payment confirmation." };
  }

  const isValid = verifyRazorpayCheckoutSignature(parsed.data);
  if (!isValid) {
    // Never finalize on an unverified signature - this is the one check
    // standing between "anyone who can call this action" and "mark an
    // order paid". A failed check here is treated as a soft failure: the
    // order simply stays 'pending' and the webhook remains authoritative.
    console.error("Razorpay checkout signature verification failed", {
      razorpayOrderId: parsed.data.razorpayOrderId,
    });
    return { ok: false, error: "We couldn't verify that payment. It may still be processing." };
  }

  const admin = createAdminClient();

  // Defense in depth: the signature proves the payment is genuine for this
  // razorpay_order_id, but also confirm it actually belongs to the caller
  // before returning any order details, since finalize_razorpay_order
  // itself has no notion of "the current user" (it's a service-role-only
  // function keyed purely by razorpay_order_id, so it can be called from
  // the webhook where no user session exists at all).
  const { data: existingOrder } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("razorpay_order_id", parsed.data.razorpayOrderId)
    .maybeSingle();

  if (!existingOrder || existingOrder.user_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  const { data: finalized, error } = await admin.rpc("finalize_razorpay_order", {
    p_razorpay_order_id: parsed.data.razorpayOrderId,
    p_razorpay_payment_id: parsed.data.razorpayPaymentId,
  });

  if (error || !finalized) {
    console.error("finalize_razorpay_order failed:", error);
    return { ok: false, error: "We couldn't confirm your order. Please contact support." };
  }

  return { ok: true, orderId: finalized.id };
}