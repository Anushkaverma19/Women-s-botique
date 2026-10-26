import { NextResponse } from "next/server";
import { verifyRazorpayCheckoutSignature } from "@/lib/razorpay/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/auth";

/**
 * VULN-08 Remediation: Verify Razorpay signature AND finalize database order state.
 * Transitions order payment_status from 'pending' to 'paid', clears the user's cart,
 * and confirms the transaction atomically.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required parameters: razorpayOrderId, razorpayPaymentId, razorpaySignature.",
        },
        { status: 400 }
      );
    }

    // 1. Strict cryptographic verification (HMAC-SHA256 constant time)
    const isValid = verifyRazorpayCheckoutSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      console.warn("Invalid Razorpay payment signature received:", {
        razorpayOrderId,
        razorpayPaymentId,
      });
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: "Signature verification failed. The payment could not be confirmed.",
        },
        { status: 400 }
      );
    }

    // 2. Database Order Finalization & State Transition
    const admin = createAdminClient();
    const currentUser = await getSessionUser();

    // Check if matching order exists in DB
    const { data: existingOrder } = await admin
      .from("orders")
      .select("id, user_id, payment_status")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (existingOrder) {
      // Authorization defense-in-depth: if user is logged in, ensure order belongs to them
      if (currentUser && existingOrder.user_id && existingOrder.user_id !== currentUser.id) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized access to order." },
          { status: 403 }
        );
      }

      // Execute atomic idempotent RPC to mark order 'paid' and clear cart
      const { data: finalized, error: finalizeError } = await admin.rpc(
        "finalize_razorpay_order",
        {
          p_razorpay_order_id: razorpayOrderId,
          p_razorpay_payment_id: razorpayPaymentId,
        }
      );

      if (finalizeError) {
        console.error("finalize_razorpay_order failed in /api/razorpay/verify:", finalizeError);
        return NextResponse.json(
          { ok: false, error: "Payment signature verified, but order finalization failed." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        verified: true,
        finalized: true,
        orderId: finalized?.id || existingOrder.id,
        message: "Payment signature verified and order confirmed successfully.",
        razorpayOrderId,
        razorpayPaymentId,
      });
    }

    // If order was a standalone test without pre-created DB row (e.g. testing console)
    return NextResponse.json({
      ok: true,
      verified: true,
      finalized: false,
      message: "Payment signature verified successfully.",
      razorpayOrderId,
      razorpayPaymentId,
    });
  } catch (error: unknown) {
    console.error("Error verifying Razorpay payment:", error);
    const message = error instanceof Error ? error.message : "Failed to verify Razorpay payment.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
