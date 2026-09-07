import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateCartId, getCartSummary } from "@/lib/cart/queries";
import { cartItemSchema } from "@/lib/validations/schemas";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const profile = await requireUser();
    const body = cartItemSchema.parse(await request.json());
    const supabase = await createClient();

    // Never trust the client for availability - re-check the variant here.
    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .select("id, active, stock_quantity")
      .eq("id", body.variantId)
      .maybeSingle();

    if (variantError || !variant || !variant.active) {
      return NextResponse.json({ error: "This size/color is not available." }, { status: 400 });
    }

    const cartId = await getOrCreateCartId(profile.id);

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", body.variantId)
      .maybeSingle();

    const desiredQuantity = (existing?.quantity ?? 0) + body.quantity;

    if (desiredQuantity > variant.stock_quantity) {
      return NextResponse.json(
        { error: `Only ${variant.stock_quantity} left in stock for this item.` },
        { status: 409 }
      );
    }

    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: desiredQuantity })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("cart_items")
        .insert({ cart_id: cartId, variant_id: body.variantId, quantity: body.quantity });
    }

    const summary = await getCartSummary(profile.id);
    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
