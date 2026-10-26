import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getCartSummary } from "@/lib/cart/queries";
import { validateCoupon } from "@/lib/coupons/validate";
import { getRazorpayClient } from "@/lib/razorpay/client";

const FLAT_SHIPPING = 149;
const FREE_SHIPPING_THRESHOLD = 5000;

export async function POST(request: Request) {
  try {
    // VULN-03: Require authenticated user session (stops unauthenticated bot automation)
    const profile = await requireUser();

    // VULN-02: NEVER accept amount from client payload.
    // Calculate order total authoritatively from server database.
    const body = await request.json().catch(() => ({}));
    const { items, subtotal } = await getCartSummary(profile.id);

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Your bag is empty. Please add items before checking out." },
        { status: 400 }
      );
    }

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    let discount = 0;

    if (body.couponCode && typeof body.couponCode === "string" && body.couponCode.trim()) {
      const couponResult = await validateCoupon(body.couponCode.trim(), subtotal);
      if (couponResult.valid && couponResult.discountAmount) {
        discount = couponResult.discountAmount;
      }
    }

    const finalAmountInRupees = Math.max(1, subtotal - discount + shipping);
    const amountInPaise = Math.round(finalAmountInRupees * 100);

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        user_id: profile.id,
        user_email: profile.email || "",
      },
    });

    const keyId =
      process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      keyId,
    });
  } catch (error: unknown) {
    console.error("Error creating Razorpay order:", error);
    const message = error instanceof Error ? error.message : "Failed to create Razorpay order.";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}
