import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getCartSummary } from "@/lib/cart/queries";
import { checkoutSchema } from "@/lib/validations/schemas";
import { handleApiError } from "@/lib/api-response";

const FLAT_SHIPPING = 149;
const FREE_SHIPPING_THRESHOLD = 5000;

export async function POST(request: Request) {
  try {
    const profile = await requireUser();
    const body = checkoutSchema.parse(await request.json());
    const supabase = await createClient();

    const { items, subtotal } = await getCartSummary(profile.id);
    if (items.length === 0) {
      return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
    }

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

    const rpcItems = items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc("place_order", {
      p_user_id: profile.id,
      p_items: rpcItems,
      p_coupon_code: body.couponCode || null,
      p_shipping: shipping,
      p_customer_name: body.customerName,
      p_customer_email: body.customerEmail,
      p_customer_phone: body.customerPhone,
      p_shipping_address: body.shippingAddress,
      p_shipping_city: body.shippingCity,
      p_shipping_state: body.shippingState,
      p_shipping_postal_code: body.shippingPostalCode,
      p_shipping_country: body.shippingCountry || "India",
      p_payment_success: body.paymentOutcome === "success",
    });

    if (error) {
      const code = (error.message || "").split(":")[0].trim();
      const messages: Record<string, string> = {
        EMPTY_CART: "Your bag is empty.",
        VARIANT_UNAVAILABLE: "One of the items in your bag is no longer available.",
        INSUFFICIENT_STOCK: "One of the items in your bag just sold out. Please review your bag.",
        INVALID_COUPON: "That coupon code isn't valid.",
        COUPON_EXPIRED: "That coupon has expired.",
        MINIMUM_NOT_MET: "Your bag doesn't meet the minimum for this coupon.",
        PAYMENT_FAILED: "Payment could not be processed. Please try again.",
      };
      return NextResponse.json(
        { error: messages[code] ?? "We couldn't place this order. Please try again.", code },
        { status: code === "PAYMENT_FAILED" ? 402 : 400 }
      );
    }

    return NextResponse.json({ order: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
