import "server-only";

/**
 * Lightweight rate limiting for Route Handlers / middleware.
 *
 * Two backends:
 *  - Upstash Redis (via plain REST calls, no SDK dependency) when
 *    UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are configured. This
 *    is the backend that actually works correctly once the app is deployed
 *    across multiple serverless instances (Vercel, etc.) - every instance
 *    shares the same counters.
 *  - An in-memory sliding-window fallback, used automatically when Upstash
 *    isn't configured (e.g. local dev). This only limits requests within a
 *    single running process/instance - fine for one dev server, NOT
 *    sufficient by itself once the app is horizontally scaled across many
 *    server instances, since each instance would track its own counters.
 *
 * At ~10k concurrent users, plug in Upstash (or any shared store) by
 * setting the two env vars below - no code changes required.
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the caller should retry. */
  retryAfter: number;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback store: key -> array of request timestamps (ms).
const memoryStore = new Map<string, number[]>();

// Periodically clear stale entries so this Map can't grow unbounded on a
// long-lived process (e.g. a self-hosted Node server, not serverless).
let lastSweep = Date.now();
function sweepMemoryStore(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, timestamps] of memoryStore) {
    const fresh = timestamps.filter((t) => now - t < windowMs);
    if (fresh.length === 0) memoryStore.delete(key);
    else memoryStore.set(key, fresh);
  }
}

async function limitWithUpstash(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Fixed-window counter implemented with two Redis commands via the
  // Upstash REST pipeline endpoint: INCR then, only on the first hit in the
  // window, EXPIRE. This keeps it to a single round trip.
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const redisKey = `ratelimit:${key}:${bucket}`;

  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, String(windowSeconds)],
    ]),
    // Never let a Redis hiccup block the request indefinitely.
    signal: AbortSignal.timeout(1500),
  });

  if (!res.ok) throw new Error(`Upstash rate limit request failed: ${res.status}`);
  const [incrResult] = (await res.json()) as { result: number }[];
  const count = incrResult.result;

  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfter: windowSeconds,
  };
}

function limitWithMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const windowMs = windowSeconds * 1000;
  sweepMemoryStore(windowMs);

  const now = Date.now();
  const timestamps = (memoryStore.get(key) ?? []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  memoryStore.set(key, timestamps);

  const success = timestamps.length <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfter: windowSeconds,
  };
}

/**
 * Checks and increments the rate-limit counter for `key`.
 * Fails open (allows the request) if the Upstash backend errors, so a
 * third-party outage never takes the whole site down - it just falls back
 * to no limiting for that request.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await limitWithUpstash(key, limit, windowSeconds);
    } catch (err) {
      console.error("Rate limit backend error, failing open:", err);
      return { success: true, limit, remaining: limit, retryAfter: windowSeconds };
    }
  }
  return limitWithMemory(key, limit, windowSeconds);
}

/** Best-effort client identifier for anonymous rate limiting. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
