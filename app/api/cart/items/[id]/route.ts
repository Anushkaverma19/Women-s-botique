import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getCartSummary } from "@/lib/cart/queries";
import { handleApiError } from "@/lib/api-response";
import { z } from "zod";

const updateSchema = z.object({ quantity: z.number().int().min(1).max(10) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const { quantity } = updateSchema.parse(await request.json());
    const supabase = await createClient();

    const { data: item } = await supabase
      .from("cart_items")
      .select("id, variant_id, cart:carts!inner(user_id)")
      .eq("id", id)
      .maybeSingle();

    if (!item || (item.cart as unknown as { user_id: string }).user_id !== profile.id) {
      return NextResponse.json({ error: "Cart item not found." }, { status: 404 });
    }

    const { data: variant } = await supabase
      .from("product_variants")
      .select("stock_quantity")
      .eq("id", item.variant_id)
      .maybeSingle();

    if (!variant || quantity > variant.stock_quantity) {
      return NextResponse.json(
        { error: `Only ${variant?.stock_quantity ?? 0} left in stock for this item.` },
        { status: 409 }
      );
    }

    await supabase.from("cart_items").update({ quantity }).eq("id", id);

    const summary = await getCartSummary(profile.id);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const supabase = await createClient();

    // RLS also enforces ownership, but this belt-and-suspenders check gives
    // a clean 404 instead of a silent no-op delete.
    const { data: item } = await supabase
      .from("cart_items")
      .select("id, cart:carts!inner(user_id)")
      .eq("id", id)
      .maybeSingle();

    if (!item || (item.cart as unknown as { user_id: string }).user_id !== profile.id) {
      return NextResponse.json({ error: "Cart item not found." }, { status: 404 });
    }

    await supabase.from("cart_items").delete().eq("id", id);

    const summary = await getCartSummary(profile.id);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
