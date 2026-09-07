import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductsByOccasion } from "@/lib/products/queries";
import { OCCASIONS } from "@/types/database";
import { handleApiError } from "@/lib/api-response";

const schema = z.object({ occasion: z.enum(OCCASIONS) });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { occasion } = schema.parse({ occasion: searchParams.get("occasion") });
    const products = await getProductsByOccasion(occasion, 8);
    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        basePrice: p.base_price,
        compareAtPrice: p.compare_at_price,
        image: p.images[0]?.image_url ?? null,
        inStock: p.variants.some((v) => v.active && v.stock_quantity > 0),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
