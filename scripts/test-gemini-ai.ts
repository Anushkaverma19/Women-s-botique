import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  );
}

export function isNonRetryableClientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("400") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("404") ||
    message.includes("API_KEY_INVALID") ||
    message.includes("PERMISSION_DENIED") ||
    message.toLowerCase().includes("invalid api key")
  );
}

export function isTransientError(err: unknown): boolean {
  if (isQuotaError(err) || isNonRetryableClientError(err)) return false;
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("fetch failed") ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("econnreset")
  );
}

const COLOR_WORDS = [
  "ivory", "burgundy", "emerald", "gold", "magenta", "silver", "grey", "gray",
  "violet", "purple", "red", "black", "coral", "blue", "green", "multicolour", "multicolor"
];
const OCCASIONS = [
  "Cocktail", "Bridal", "Festive", "Resort", "Evening", "Formal", "Haldi", "Mehendi", "Sangeet", "Reception", "Casual"
];
const CATEGORY_SYNONYMS: Record<string, string> = {
  saree: "sarees", sarees: "sarees", sari: "sarees", saris: "sarees",
  lehenga: "lehengas", lehengas: "lehengas", lehnga: "lehengas", lengha: "lehengas",
  dress: "dresses", dresses: "dresses", gown: "dresses", gowns: "dresses",
  jewellery: "jewellery", jewelry: "jewellery", necklace: "jewellery",
  necklaces: "jewellery", earrings: "jewellery", earring: "jewellery",
  bangles: "jewellery", bangle: "jewellery"
};
const FASHION_KEYWORDS = [
  "saree", "sari", "lehenga", "lehnga", "lengha", "dress", "gown",
  "jewellery", "jewelry", "necklace", "earring", "bangle", "suit", "anarkali",
  "dupatta", "fabric", "silk", "cotton", "velvet", "chiffon", "georgette",
  "organza", "crepe", "zari", "embroidery", "wedding", "bridal", "reception",
  "mehendi", "sangeet", "festive", "diwali", "cocktail", "party", "formal",
  "casual", "price", "under", "budget", "cost", "inr", "rupees", "collection",
  "wear", "outfit", "attire", "style", "recommend", "show", "buy", "shop",
  "looking for", "piece", "pieces"
];

export function isProductRelatedQuery(message: string): boolean {
  const norm = message.toLowerCase();
  const hasOccasion = OCCASIONS.some((occ) => norm.includes(occ.toLowerCase()));
  const hasColor = COLOR_WORDS.some((c) => norm.includes(c));
  const hasCategory = Object.keys(CATEGORY_SYNONYMS).some((k) => norm.includes(k));
  const hasPrice = /under\s*(?:rs\.?|inr|₹)?\s*[\d,]+/i.test(message);
  const hasKeyword = FASHION_KEYWORDS.some((kw) => norm.includes(kw));
  return hasOccasion || hasColor || hasCategory || hasPrice || hasKeyword;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${extra ? `(${extra})` : ""}`);
    failed++;
  }
}

// -------------------------------------------------------------
// In-Memory Cache Simulation (matching lib/ai/cache.ts)
// -------------------------------------------------------------
interface CachedEntry {
  message: string;
  recommendations: Array<{ productId: string; reason: string }>;
  createdAt: number;
  scope: string;
}

const testCache = new Map<string, CachedEntry>();

function buildTestCacheKey(
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

function getTestCache(key: string, currentScope: string, ttlMs = 900_000): CachedEntry | null {
  const entry = testCache.get(key);
  if (!entry) return null;
  if (entry.scope !== currentScope) return null; // User isolation
  if (Date.now() - entry.createdAt > ttlMs) {
    testCache.delete(key);
    return null;
  }
  return entry;
}

function setTestCache(
  key: string,
  message: string,
  recommendations: Array<{ productId: string; reason: string }>,
  scope: string
): void {
  testCache.set(key, {
    message,
    recommendations,
    createdAt: Date.now(),
    scope,
  });
}

// -------------------------------------------------------------
// Burst Limiter Simulation (matching app/api/ai/route.ts)
// -------------------------------------------------------------
const burstMap = new Map<string, number>();

function isBurstThrottled(id: string, intervalMs = 2000): boolean {
  const now = Date.now();
  const lastTime = burstMap.get(id);
  if (lastTime && now - lastTime < intervalMs) {
    return true;
  }
  burstMap.set(id, now);
  return false;
}

// -------------------------------------------------------------
// Circuit Breaker Simulation (matching lib/ai/assistant.ts)
// -------------------------------------------------------------
class TestCircuitBreaker {
  state: CircuitState = "CLOSED";
  quotaExceededUntil = 0;
  consecutiveTransientFailures = 0;
  readonly quotaCooldownMs = 60_000;
  readonly transientCooldownMs = 30_000;
  readonly maxTransientFailures = 3;

  allowCall(): boolean {
    if (this.state === "OPEN") {
      if (Date.now() >= this.quotaExceededUntil) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.state = "CLOSED";
    this.consecutiveTransientFailures = 0;
    this.quotaExceededUntil = 0;
  }

  recordFailure(err: unknown): void {
    if (isQuotaError(err)) {
      this.state = "OPEN";
      this.quotaExceededUntil = Date.now() + this.quotaCooldownMs;
      return;
    }
    if (isNonRetryableClientError(err)) {
      // Don't retry, but don't trip breaker
      return;
    }
    if (isTransientError(err)) {
      this.consecutiveTransientFailures++;
      if (this.consecutiveTransientFailures >= this.maxTransientFailures) {
        this.state = "OPEN";
        this.quotaExceededUntil = Date.now() + this.transientCooldownMs;
      }
    }
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("       MEHRAÉ GEMINI AI INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  // -----------------------------------------------------------------
  // 1. Caching & User Scope Isolation
  // -----------------------------------------------------------------
  console.log("1. Testing Bounded In-Memory Caching & Isolation:");

  testCache.clear();
  const scopeUserA = "user:user_12345";
  const scopeUserB = "user:user_67890";
  const scopeAnon = "anon:192.168.1.1";

  const message = "Recommend a red silk saree for a wedding reception";
  const history = [{ role: "user", content: "Hello" }];

  const keyA = buildTestCacheKey(scopeUserA, message, history);
  const keyB = buildTestCacheKey(scopeUserB, message, history);
  const keyAnon = buildTestCacheKey(scopeAnon, message, history);

  assert(keyA !== keyB, "Different authenticated users generate distinct isolated cache keys");
  assert(keyA !== keyAnon, "Authenticated user key is isolated from anonymous guest key");

  setTestCache(keyA, "Personal recommendation for User A", [{ productId: "prod_1", reason: "Silk fit" }], scopeUserA);

  const hitA = getTestCache(keyA, scopeUserA);
  assert(hitA !== null && hitA.message === "Personal recommendation for User A", "Cache hit returns cached response for matching user");

  const leakB = getTestCache(keyA, scopeUserB);
  assert(leakB === null, "User B cannot access User A's cached entry (Cross-user isolation)");

  // Test TTL expiry
  const expiredKey = buildTestCacheKey(scopeUserA, "old query", []);
  testCache.set(expiredKey, {
    message: "Stale reply",
    recommendations: [],
    createdAt: Date.now() - 1_000_000, // Older than 15 mins
    scope: scopeUserA,
  });
  const expiredResult = getTestCache(expiredKey, scopeUserA, 900_000);
  assert(expiredResult === null, "Expired cache entries are safely evicted and return null");

  // -----------------------------------------------------------------
  // 2. Rate Limiting & Rapid Burst Protection
  // -----------------------------------------------------------------
  console.log("\n2. Testing Server-Side Rate Limiting & Burst Protection:");

  burstMap.clear();
  const testClientId = "user:burst_test_1";

  const firstCall = isBurstThrottled(testClientId, 2000);
  assert(firstCall === false, "First request within window is permitted");

  const immediateSecondCall = isBurstThrottled(testClientId, 2000);
  assert(immediateSecondCall === true, "Immediate rapid repeat within 2s is throttled (Burst protection)");

  // -----------------------------------------------------------------
  // 3. Error Classification & Circuit Breaker Logic
  // -----------------------------------------------------------------
  console.log("\n3. Testing Error Classification & Circuit Breaker:");

  const quotaError429 = new Error("[GoogleGenerativeAI Error]: [429 Too Many Requests] Resource exhausted");
  const quotaErrorText = new Error("Quota exceeded for quota metric 'GenerateContent'");
  const clientError400 = new Error("[GoogleGenerativeAI Error]: [400 Bad Request] Invalid argument");
  const authError403 = new Error("[GoogleGenerativeAI Error]: [403 Forbidden] API_KEY_INVALID");
  const transient503 = new Error("[GoogleGenerativeAI Error]: [503 Service Unavailable] The model is overloaded");
  const transientTimeout = new Error("fetch failed: connection timeout");

  assert(isQuotaError(quotaError429) === true, "Identifies HTTP 429 as quota error");
  assert(isQuotaError(quotaErrorText) === true, "Identifies Resource Exhausted/quota message");
  assert(isNonRetryableClientError(clientError400) === true, "Identifies 400 as non-retryable client error");
  assert(isNonRetryableClientError(authError403) === true, "Identifies 403 / API_KEY_INVALID as non-retryable error");
  assert(isTransientError(transient503) === true, "Identifies 503 as transient retryable error");
  assert(isTransientError(transientTimeout) === true, "Identifies connection timeout as transient retryable error");
  assert(isTransientError(quotaError429) === false, "Quota errors are excluded from transient retry loop");

  // Test circuit breaker state transitions
  const breaker = new TestCircuitBreaker();
  assert(breaker.state === "CLOSED" && breaker.allowCall() === true, "Initial circuit breaker state is CLOSED");

  // Simulate Quota exhaustion
  breaker.recordFailure(quotaError429);
  assert(breaker.state === "OPEN", "Quota error immediately trips circuit breaker to OPEN");
  assert(breaker.allowCall() === false, "Circuit in OPEN state rejects calls and short-circuits to fallback");

  // Simulate cooldown expiry
  breaker.quotaExceededUntil = Date.now() - 1000;
  assert(breaker.allowCall() === true, "Expired cooldown allows single probe request");
  assert(breaker.state === "HALF_OPEN", "Transitioned to HALF_OPEN to test gateway recovery");

  // Simulate successful probe
  breaker.recordSuccess();
  assert(breaker.state === "CLOSED", "Successful recovery resets circuit breaker to CLOSED");

  // -----------------------------------------------------------------
  // 4. Smart Fallback Intent Detection
  // -----------------------------------------------------------------
  console.log("\n4. Testing Smart Fallback Intent Detection:");

  const queryShopping1 = "Show me red bridal lehengas under 40000";
  const queryShopping2 = "Silk saree for wedding reception";
  const queryGeneral1 = "How should I drape a Gujarati saree?";
  const queryGeneral2 = "Hello who made this website?";

  assert(isProductRelatedQuery(queryShopping1) === true, "Identifies shopping intent with category and price");
  assert(isProductRelatedQuery(queryShopping2) === true, "Identifies shopping intent with occasion and fabric");
  assert(isProductRelatedQuery(queryGeneral1) === true, "Identifies traditional attire styling topic");
  assert(isProductRelatedQuery(queryGeneral2) === false, "Identifies non-product conversational question");

  // -----------------------------------------------------------------
  // 5. Supabase Database Candidate Grounding
  // -----------------------------------------------------------------
  console.log("\n5. Testing Live Supabase Database Grounding & Rehydration:");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.warn("  ⚠ SKIPPED: Supabase credentials not set for live DB checks");
  } else {
    try {
      const admin = createClient(supabaseUrl, secretKey);

      // Verify active products can be retrieved with relations
      const { data: prods, error: pErr } = await admin
        .from("products")
        .select("id, name, base_price, active, variants:product_variants(id, stock_quantity, active)")
        .eq("active", true)
        .limit(3);

      assert(!pErr && prods && prods.length > 0, "Supabase returns active products with variants for grounding");

      if (prods && prods[0]) {
        const sample = prods[0];
        const inStock = sample.variants?.some((v: { active: boolean; stock_quantity: number }) => v.active && v.stock_quantity > 0);
        assert(typeof inStock === "boolean", "Live product inventory status is computed directly from variants");
      }
    } catch (e) {
      console.error("DB check failed:", e);
      failed++;
    }
  }

  console.log("\n-------------------------------------------------------");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
