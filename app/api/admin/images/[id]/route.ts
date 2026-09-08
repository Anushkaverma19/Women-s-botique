import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-response";

const updateSchema = z.object({
  altText: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const admin = createAdminClient();

    const update: Record<string, unknown> = {};
    if (body.altText !== undefined) update.alt_text = body.altText;
    if (body.sortOrder !== undefined) update.sort_order = body.sortOrder;

    const { data, error } = await admin
      .from("product_images")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ image: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();

    // Refuse to delete a product's last remaining image - every active
    // product should always have at least one image for the storefront.
    const { data: image } = await admin
      .from("product_images")
      .select("product_id")
      .eq("id", id)
      .maybeSingle();

    if (image) {
      const { count } = await admin
        .from("product_images")
        .select("*", { count: "exact", head: true })
        .eq("product_id", image.product_id);

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last image for a product." },
          { status: 400 }
        );
      }
    }

    const { error } = await admin.from("product_images").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
