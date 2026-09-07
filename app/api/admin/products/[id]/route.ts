import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { productFormSchema } from "@/lib/validations/schemas";
import { handleApiError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = productFormSchema.partial().parse(await request.json());
    const admin = createAdminClient();

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.slug !== undefined) update.slug = body.slug;
    if (body.categoryId !== undefined) update.category_id = body.categoryId;
    if (body.description !== undefined) update.description = body.description;
    if (body.shortDescription !== undefined) update.short_description = body.shortDescription;
    if (body.basePrice !== undefined) update.base_price = body.basePrice;
    if (body.compareAtPrice !== undefined) update.compare_at_price = body.compareAtPrice;
    if (body.material !== undefined) update.material = body.material;
    if (body.care !== undefined) update.care = body.care;
    if (body.colorFamily !== undefined) update.color_family = body.colorFamily;
    if (body.occasionTags !== undefined) update.occasion_tags = body.occasionTags;
    if (body.featured !== undefined) update.featured = body.featured;
    if (body.active !== undefined) update.active = body.active;

    const { data, error } = await admin.from("products").update(update).eq("id", id).select().single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ product: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    // Soft-delete only: deactivating preserves order history integrity
    // rather than a hard delete that could orphan order_items references.
    const { error } = await admin.from("products").update({ active: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
