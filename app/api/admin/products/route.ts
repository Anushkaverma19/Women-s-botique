import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { productFormSchema } from "@/lib/validations/schemas";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = productFormSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("products")
      .insert({
        name: body.name,
        slug: body.slug,
        category_id: body.categoryId,
        description: body.description,
        short_description: body.shortDescription,
        base_price: body.basePrice,
        compare_at_price: body.compareAtPrice ?? null,
        material: body.material,
        care: body.care,
        color_family: body.colorFamily,
        occasion_tags: body.occasionTags,
        featured: body.featured,
        active: body.active,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
