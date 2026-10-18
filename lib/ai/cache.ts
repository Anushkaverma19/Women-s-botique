import "server-only";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithRelations } from "@/types/database";

export interface CachedRecommendation {
  productId: string;
  reason: string;
}

export interface CachedAiEntry {
  message: string;
  recommendations: CachedRecommendation[];
  createdAt: number;
  scope: string;
}

const CACHE_MAX_ENTRIES = 100;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

// Bounded in-memory cache: Map preserves insertion order for LRU eviction
const cacheMap = new Map<string, CachedAiEntry>();

/**
 * Builds a deterministic SHA-256 cache key scoped to the specific user or guest session.
 * Never shares responses between different user scopes.
 */
export function buildAiCacheKey(
  scope: string,
  message: string,
  history: Array<{ role: string; content: string }>
): string {
  const normMessage = message.trim().toLowerCase().replace(/\s+/g, " ");
  const normHistory = history
    .slice(-4)
    .map((h) => `${h.role}:${h.content.trim().toLowerCase().slice(0, 100)}`)
    .join("|");

  const raw = `${scope}::${normMessage}::${normHistory}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Retrieves a cached entry if present, unexpired, and belonging to the same scope.
 */
export function getCachedAiResponse(key: string, currentScope: string): CachedAiEntry | null {
  const entry = cacheMap.get(key);
  if (!entry) return null;

  // Strict isolation: Never share responses across different user scopes
  if (entry.scope !== currentScope) {
    return null;
  }

  // Check TTL expiry
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cacheMap.delete(key);
    return null;
  }

  // Refresh LRU position by re-inserting
  cacheMap.delete(key);
  cacheMap.set(key, entry);

  return entry;
}

/**
 * Stores an AI response in the bounded in-memory cache.
 */
export function setCachedAiResponse(
  key: string,
  message: string,
  recommendations: Array<{ product: { id: string }; reason: string }>,
  scope: string
): void {
  // Bounded size: evict oldest entry if at capacity
  if (cacheMap.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cacheMap.keys().next().value;
    if (oldestKey) cacheMap.delete(oldestKey);
  }

  cacheMap.set(key, {
    message,
    recommendations: recommendations.map((r) => ({
      productId: r.product.id,
      reason: r.reason,
    })),
    createdAt: Date.now(),
    scope,
  });
}

/**
 * Rehydrates cached recommendations against live Supabase data so that
 * cached recommendations never present outdated prices or out-of-stock
 * items as current.
 */
export async function rehydrateCachedRecommendations(
  cachedRecs: CachedRecommendation[]
): Promise<Array<{ product: ProductWithRelations; reason: string }>> {
  if (cachedRecs.length === 0) return [];

  try {
    const supabase = await createClient();
    const productIds = cachedRecs.map((r) => r.productId);

    const { data, error } = await supabase
      .from("products")
      .select(
        "*, category:categories(*), images:product_images(*), variants:product_variants(*)"
      )
      .in("id", productIds)
      .eq("active", true);

    if (error || !data || data.length === 0) {
      return [];
    }

    const liveProducts = (data as unknown as ProductWithRelations[]).map((p) => ({
      ...p,
      images: [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }));

    const productMap = new Map(liveProducts.map((p) => [p.id, p]));
    const rehydrated: Array<{ product: ProductWithRelations; reason: string }> = [];

    for (const rec of cachedRecs) {
      const live = productMap.get(rec.productId);
      if (!live) continue; // Product inactive or removed

      // Only recommend if actually in stock right now
      const inStock = live.variants?.some((v) => v.active && v.stock_quantity > 0);
      if (!inStock) continue; // Out of stock items omitted so cached items don't mislead

      rehydrated.push({
        product: live,
        reason: rec.reason,
      });
    }

    return rehydrated;
  } catch (err) {
    console.error("Failed to rehydrate cached recommendations:", err);
    return [];
  }
}

/**
 * Helper for tests to clear cache or inspect size.
 */
export function _resetAiCacheForTesting(): void {
  cacheMap.clear();
}

export function _getAiCacheSizeForTesting(): number {
  return cacheMap.size;
}
