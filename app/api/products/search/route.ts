import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products/queries";
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
    }));
    return NextResponse.json(
      { products: trimmed },
      {
        // Public, non-personalised catalogue data: safe to cache briefly at
        // the CDN edge. stale-while-revalidate means most repeat searches
        // (very common with a live-typing search box) are served instantly
        // from cache instead of hitting Supabase on every keystroke, which
        // matters a lot at ~10k concurrent users.
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
