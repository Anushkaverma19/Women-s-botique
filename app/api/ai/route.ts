import { NextResponse } from "next/server";
import { aiChatSchema } from "@/lib/validations/schemas";
import { askMehrae } from "@/lib/ai/assistant";
import { handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { ProductWithRelations } from "@/types/database";

// The Gemini-backed chatbot is the most expensive and quota-limited
// endpoint in the app, so it gets its own (tighter) limit rather than
// relying only on the general middleware limit: 12 messages/minute per
// client is generous for a real conversation but blocks scripted abuse
// that would otherwise burn through the shared Gemini quota for everyone.
const AI_LIMIT = 12;
const AI_WINDOW_SECONDS = 60;

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
    const ip = getClientIp(request);
    const { success, retryAfter } = await rateLimit(`ai:${ip}`, AI_LIMIT, AI_WINDOW_SECONDS);
    if (!success) {
      return NextResponse.json(
        { error: "ASK MEHRAÉ is getting a lot of messages right now - please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

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
