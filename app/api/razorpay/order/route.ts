import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCartSummary } from "@/lib/cart/queries";
import { getRazorpayClient } from "@/lib/razorpay/client";

const FLAT_SHIPPING = 149;
const FREE_SHIPPING_THRESHOLD = 5000;

export async function POST(request: Request) {
  try {
    const profile = await requireUser();
    const body = await request.json().catch(() => ({}));
    const { items, subtotal } = await getCartSummary(profile.id);

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Your bag is empty. Please add items before checking out." },
        { status: 400 }
      );
    }

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const rpcItems = items.map((i) => ({
      variant_id: i.variant_id,
      quantity: i.quantity,
    }));

    // 1. Reserve stock and create pending order row in PostgreSQL
    const supabase = await createClient();
    const { data: order, error: rpcError } = await supabase.rpc("create_razorpay_order", {
      p_user_id: profile.id,
      p_items: rpcItems,
      p_coupon_code: body.couponCode || null,
      p_shipping: shipping,
      p_customer_name: body.customerName || profile.full_name || "Valued Customer",
      p_customer_email: body.customerEmail || profile.email || "",
      p_customer_phone: body.customerPhone || "0000000000",
      p_shipping_address: body.shippingAddress || "Pending address",
      p_shipping_city: body.shippingCity || "Pending city",
      p_shipping_state: body.shippingState || "Pending state",
      p_shipping_postal_code: body.shippingPostalCode || "000000",
      p_shipping_country: body.shippingCountry || "India",
    });

    if (rpcError || !order) {
      return NextResponse.json(
        { ok: false, error: rpcError?.message ?? "Inventory reservation failed." },
        { status: 400 }
      );
    }

    // 2. Authoritative server amount calculation
    const amountInPaise = Math.round(order.total * 100);
    const razorpay = getRazorpayClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order.order_number,
      notes: { mehrae_order_id: order.id, user_id: profile.id },
    });

    // 3. Link Razorpay order ID to the database row
    const admin = createAdminClient();
    await admin
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq("id", order.id);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      keyId: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error: unknown) {
    console.error("Error creating Razorpay order:", error);
    const message = error instanceof Error ? error.message : "Failed to create Razorpay order.";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
