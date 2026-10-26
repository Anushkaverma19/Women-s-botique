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
 *    single running process/instance.
 *
 * Fail-safe & Resilient Architecture:
 *  - Upstash Redis timeouts (via 1500ms AbortSignal) and HTTP 404 / 5xx errors
 *    are caught cleanly.
 *  - Fails open (allows the request) so rate-limiter downtime or upstream network hiccups
 *    never block valid user authentication, cart queries, or payment API routes.
 */

export interface RateLimitResult {
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
  const baseUrl = UPSTASH_URL?.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/pipeline`;
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const redisKey = `ratelimit:${key}:${bucket}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, String(windowSeconds)],
    ]),
    // Bounded timeout (1500ms) so Upstash latency never degrades user response times
    signal: AbortSignal.timeout(1500),
  });

  if (!res.ok) {
    throw new Error(`Upstash rate limit request failed: HTTP ${res.status}`);
  }

  const raw = await res.json();
  const [incrResult] = (Array.isArray(raw) ? raw : []) as { result?: number | { result?: number } }[];

  let count = 1;
  if (incrResult) {
    if (typeof incrResult.result === "number") {
      count = incrResult.result;
    } else if (
      incrResult.result &&
      typeof incrResult.result === "object" &&
      typeof (incrResult.result as { result?: number }).result === "number"
    ) {
      count = (incrResult.result as { result: number }).result;
    }
  }

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
 * Fails open (allows the request) if the Upstash backend times out or errors (e.g. 404 / 500),
 * guaranteeing third-party Redis latency or downtime never blocks customer transactions.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await limitWithUpstash(key, limit, windowSeconds);
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          err.message.toLowerCase().includes("timeout") ||
          err.message.toLowerCase().includes("abort"));
      const isNotFound = err instanceof Error && err.message.includes("404");

      console.warn(
        `[RateLimit] Upstash Redis ${isTimeout ? "timed out" : isNotFound ? "returned 404" : "error"}. Failing open:`,
        err instanceof Error ? err.message : err
      );

      // Fail-open: allow the request so auth, cart, and payment routes remain operational
      return {
        success: true,
        limit,
        remaining: limit,
        retryAfter: windowSeconds,
      };
    }
  }

  try {
    return limitWithMemory(key, limit, windowSeconds);
  } catch (err) {
    console.warn("[RateLimit] In-memory rate limiting fallback error. Failing open:", err);
    return {
      success: true,
      limit,
      remaining: limit,
      retryAfter: windowSeconds,
    };
  }
}

/**
 * Client identifier for rate limiting.
 * VULN-07 Remediation: Prioritize trusted, platform-controlled proxy headers
 * (Cloudflare / Vercel) over generic client-supplied X-Forwarded-For to prevent IP spoofing.
 */
export function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]!.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return "unknown";
}
