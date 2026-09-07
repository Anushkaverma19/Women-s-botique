import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { variantFormSchema } from "@/lib/validations/schemas";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = variantFormSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("product_variants")
      .insert({
        product_id: body.productId,
        color: body.color,
        size: body.size,
        sku: body.sku,
        price: body.price,
        stock_quantity: body.stockQuantity,
        active: body.active,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ variant: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
