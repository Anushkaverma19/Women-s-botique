import { NextResponse } from "next/server";
import { aiChatSchema } from "@/lib/validations/schemas";
import { askMehrae } from "@/lib/ai/assistant";
import { handleApiError } from "@/lib/api-response";
import type { ProductWithRelations } from "@/types/database";

function toClientProduct(product: ProductWithRelations) {
  // Trim to exactly what the UI needs - no internal fields, nothing Gemini
  // could have injected (this object is built entirely from `product`,
  // which came straight from Supabase, never from the AI response).
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.short_description,
    basePrice: product.base_price,
    compareAtPrice: product.compare_at_price,
    image: product.images[0]?.image_url ?? null,
    inStock: product.variants.some((v) => v.active && v.stock_quantity > 0),
  };
}

export async function POST(request: Request) {
  try {
    const body = aiChatSchema.parse(await request.json());
    const result = await askMehrae(body.message, body.history);

    return NextResponse.json({
      message: result.message,
      recommendations: result.recommendations.map((r) => ({
        product: toClientProduct(r.product),
        reason: r.reason,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
