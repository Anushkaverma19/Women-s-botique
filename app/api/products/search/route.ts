import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products/queries";
import { predictSearchIntent } from "@/lib/recommendations/intent-bridge";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ products: [] });
    }
    const { products } = await listProducts({ q, page: 1, sort: "featured" });
    const trimmed = products.slice(0, 6).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      basePrice: p.base_price,
      image: p.images[0]?.image_url ?? null,
      inStock: p.variants.some((v) => v.active && v.stock_quantity > 0),
      reason: undefined as string | undefined,
    }));

    // If direct keyword search produced fewer than 3 results, enrich with ML intent predictions
    if (trimmed.length < 3) {
      try {
        const intent = await predictSearchIntent(q);
        const { products: intentProducts } = await listProducts({
          category: intent.matched_category,
          page: 1,
          sort: "featured",
        });

        const seenIds = new Set(trimmed.map((p) => p.id));
        for (const p of intentProducts) {
          if (!seenIds.has(p.id)) {
            trimmed.push({
              id: p.id,
              slug: p.slug,
              name: p.name,
              basePrice: p.base_price,
              image: p.images[0]?.image_url ?? null,
              inStock: p.variants.some((v) => v.active && v.stock_quantity > 0),
              reason: `Recommended for ${intent.predicted_sub_category} intent`,
            });
            seenIds.add(p.id);
          }
          if (trimmed.length >= 6) break;
        }
      } catch (e) {
        console.warn("Intent search enrichment skipped:", e);
      }
    }

    return NextResponse.json(
      { products: trimmed },
      {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
