import { NextResponse } from "next/server";
import { predictSearchIntent } from "@/lib/recommendations/intent-bridge";
import { listProducts } from "@/lib/products/queries";
import { handleApiError } from "@/lib/api-response";
import type { ProductWithRelations } from "@/types/database";

interface ClientRecommendation {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  image: string | null;
  category: string;
  categorySlug: string;
  inStock: boolean;
  occasionTags: string[];
  recommendationReason: string;
  relevanceScore: number;
}

function scoreProduct(
  product: ProductWithRelations,
  matchedCategory: string,
  occasion: string,
  keywords: string[]
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const catSlug = product.category?.slug ?? "";
  if (catSlug.toLowerCase() === matchedCategory.toLowerCase()) {
    score += 50;
    reasons.push(product.category?.name ?? "Collection");
  }

  const tags = product.occasion_tags || [];
  if (tags.some((t) => t.toLowerCase() === occasion.toLowerCase())) {
    score += 25;
    reasons.push(`${occasion} edit`);
  }

  const text = `${product.name} ${product.description || ""}`.toLowerCase();
  let matchedKws = 0;
  keywords.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) {
      score += 10;
      matchedKws++;
    }
  });
  if (matchedKws > 0) {
    reasons.push("handcrafted details");
  }

  const inStock = product.variants?.some((v) => v.active && v.stock_quantity > 0);
  if (inStock) score += 15;
  if (product.featured) score += 10;

  const reasonStr = reasons.length > 0
    ? `Curated based on your affinity for ${reasons.join(" & ")}`
    : `Featured piece from MEHRAÉ ${product.category?.name || "curation"}`;

  return { score, reason: reasonStr };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const historyParam = searchParams.get("history") || "";
    const history = historyParam ? historyParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "6", 10)));

    return await handleRecommendations(query, history, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query : "";
    const history = Array.isArray(body.history) ? body.history.map(String) : [];
    const limit = typeof body.limit === "number" ? Math.min(20, Math.max(1, body.limit)) : 6;

    return await handleRecommendations(query, history, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleRecommendations(query: string, history: string[], limit: number) {
  // 1. Predict user intent using mehrae_search_model.pkl
  const intent = await predictSearchIntent(query, history);

  // 2. Fetch category-matched products from Supabase
  const primaryResult = await listProducts({
    category: intent.matched_category,
    page: 1,
    sort: "featured",
  });

  const candidates = [...primaryResult.products];

  // If candidate count is less than desired limit, fetch complementary pieces
  if (candidates.length < limit) {
    const fallbackResult = await listProducts({
      page: 1,
      sort: "featured",
    });
    const existingIds = new Set(candidates.map((c) => c.id));
    for (const prod of fallbackResult.products) {
      if (!existingIds.has(prod.id)) {
        candidates.push(prod);
        existingIds.add(prod.id);
      }
      if (candidates.length >= limit * 2) break;
    }
  }

  // 3. Rank products based on intent, occasion, style keywords, stock, and affinity
  const scored = candidates.map((p) => {
    const { score, reason } = scoreProduct(
      p,
      intent.matched_category,
      intent.occasion,
      intent.keywords
    );
    const inStock = p.variants?.some((v) => v.active && v.stock_quantity > 0) ?? true;
    const clientProd: ClientRecommendation = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.short_description,
      basePrice: p.base_price,
      compareAtPrice: p.compare_at_price,
      image: p.images?.[0]?.image_url ?? null,
      category: p.category?.name ?? "Collection",
      categorySlug: p.category?.slug ?? intent.matched_category,
      inStock,
      occasionTags: p.occasion_tags || [],
      recommendationReason: reason,
      relevanceScore: score,
    };
    return clientProd;
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const recommendations = scored.slice(0, limit);

  return NextResponse.json(
    {
      intent: {
        predicted_sub_category: intent.predicted_sub_category,
        matched_category: intent.matched_category,
        confidence: intent.confidence,
        occasion: intent.occasion,
        keywords: intent.keywords,
        browsing_affinity: intent.browsing_affinity,
      },
      recommendations,
      total: recommendations.length,
    },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    }
  );
}
