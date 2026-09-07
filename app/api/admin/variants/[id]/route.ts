import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { handleApiError } from "@/lib/api-response";

const updateSchema = z.object({
  color: z.string().trim().min(1).max(60).optional(),
  size: z.string().trim().min(1).max(30).optional(),
  price: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const admin = createAdminClient();

    const update: Record<string, unknown> = {};
    if (body.color !== undefined) update.color = body.color;
    if (body.size !== undefined) update.size = body.size;
    if (body.price !== undefined) update.price = body.price;
    if (body.stockQuantity !== undefined) update.stock_quantity = body.stockQuantity;
    if (body.active !== undefined) update.active = body.active;

    const { data, error } = await admin
      .from("product_variants")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ variant: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    // Deactivate rather than hard-delete, to preserve referential integrity
    // with any historical cart_items/order_items.
    const { error } = await admin.from("product_variants").update({ active: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
