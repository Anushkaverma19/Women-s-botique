import { NextResponse } from "next/server";
import { aiChatSchema } from "@/lib/validations/schemas";
import { askMehrae } from "@/lib/ai/assistant";
import { handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/supabase/auth";
import type { ProductWithRelations } from "@/types/database";

// Rolling window limit: 5 messages per 60 seconds per user / session
const AI_LIMIT = 5;
const AI_WINDOW_SECONDS = 60;

// Anti-spam burst throttle: at least 2 seconds between consecutive messages per client
const MIN_BURST_INTERVAL_MS = 2000;
const burstStore = new Map<string, number>();

function isBurstThrottled(key: string): boolean {
  const now = Date.now();
  const lastTime = burstStore.get(key);

  // Sweep stale entries periodically to prevent memory growth
  if (burstStore.size > 500) {
    for (const [k, t] of burstStore) {
      if (now - t > 30_000) burstStore.delete(k);
    }
  }

  if (lastTime && now - lastTime < MIN_BURST_INTERVAL_MS) {
    return true; // Too fast, throttled
  }

  burstStore.set(key, now);
  return false;
}

function toClientProduct(product: ProductWithRelations) {
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
    const user = await getSessionUser();
    const userScope = user ? `user:${user.id}` : `anon:${ip}`;

    // 1. Rapid burst check (prevents rapid-fire button clicking/scripting)
    if (isBurstThrottled(userScope)) {
      return NextResponse.json(
        {
          error:
            "You're sending messages too quickly. Please pause for a moment before your next question.",
        },
        { status: 429, headers: { "Retry-After": "2" } }
      );
    }

    // 2. Rolling window rate limit (per user or per IP)
    const { success, retryAfter } = await rateLimit(`ai:${userScope}`, AI_LIMIT, AI_WINDOW_SECONDS);
    if (!success) {
      return NextResponse.json(
        {
          error:
            "ASK MEHRAÉ has received several messages from your session. Please wait a minute before asking another question.",
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = aiChatSchema.parse(await request.json());
    const result = await askMehrae(body.message, body.history, userScope);

    return NextResponse.json(
      {
        message: result.message,
        recommendations: result.recommendations.map((r) => ({
          product: toClientProduct(r.product),
          reason: r.reason,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
