import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-response";

const createSchema = z.object({
  productId: z.string().uuid(),
  imageUrl: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^\/[a-zA-Z0-9\-_./]+\.(jpg|jpeg|png|webp)$/, "Must be a local path like /products/example.jpg"),
  altText: z.string().trim().max(200).default(""),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("product_images")
      .insert({
        product_id: body.productId,
        image_url: body.imageUrl,
        alt_text: body.altText,
        sort_order: body.sortOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ image: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
