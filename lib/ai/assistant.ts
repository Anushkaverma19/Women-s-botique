import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ASK_MEHRAE_SYSTEM_PROMPT, buildUserTurn } from "@/lib/ai/systemPrompt";
import {
  retrieveCandidateProducts,
  toAiContext,
  isProductRelatedQuery,
  isPromptInjectionQuery,
  detectOutOfScopeQuery,
} from "@/lib/ai/retrieval";
import type { RetrievalMeta } from "@/lib/ai/retrieval";
import {
  buildAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
  rehydrateCachedRecommendations,
} from "@/lib/ai/cache";
import type { ProductWithRelations } from "@/types/database";

export interface AskMehraeResult {
  message: string;
  recommendations: {
    product: ProductWithRelations;
    reason: string;
  }[];
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Process-local circuit breaker for Gemini quota exhaustion and transient errors.
 *
 * States:
 *  - CLOSED: Normal operation. Requests flow to Gemini.
 *  - OPEN: Quota is exhausted (429) or repeated transient failures occurred.
 *    Short-circuits immediately to grounded Supabase fallback without network overhead.
 *  - HALF_OPEN: Cooldown has elapsed. A single probe request is attempted to test recovery.
 */
const QUOTA_COOLDOWN_MS = 60_000; // 60s cooldown for quota exhaustion (429)
const TRANSIENT_COOLDOWN_MS = 30_000; // 30s cooldown after consecutive transient failures
const MAX_TRANSIENT_FAILURES = 3;

let circuitState: CircuitState = "CLOSED";
let quotaExceededUntil = 0;
let consecutiveTransientFailures = 0;

export function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  );
}

export function isTimeoutError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("timed out") ||
    message.toLowerCase().includes("abort") ||
    message.toLowerCase().includes("aborted")
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
    isTimeoutError(err) ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("econnreset") ||
    message.toLowerCase().includes("etimedout")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if the circuit breaker allows calling Gemini.
 * Transitions from OPEN to HALF_OPEN when cooldown elapses.
 */
function allowGeminiCall(): boolean {
  if (circuitState === "OPEN") {
    if (Date.now() >= quotaExceededUntil) {
      circuitState = "HALF_OPEN";
      return true; // Allow single probe request
    }
    return false; // Circuit still open
  }
  return true; // CLOSED or HALF_OPEN
}

/**
 * Calls Gemini with at most ONE retry for transient errors only.
 * Quota errors (429) and invalid credential errors are never retried.
 * Timeout increased to 25s for resilient handling during network fluctuations.
 */
async function generateWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  prompt: string,
  maxAttempts = 2
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(prompt, {
        signal: AbortSignal.timeout(25000),
      });
      // Success: reset circuit breaker state
      circuitState = "CLOSED";
      consecutiveTransientFailures = 0;
      quotaExceededUntil = 0;
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (isQuotaError(err)) {
        // Quota is exhausted: open circuit for 60s, DO NOT RETRY
        circuitState = "OPEN";
        quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
        throw err;
      }
      if (isNonRetryableClientError(err)) {
        // Client/credentials error: DO NOT RETRY
        throw err;
      }
      if (!isTransientError(err) || attempt === maxAttempts - 1) {
        consecutiveTransientFailures++;
        if (consecutiveTransientFailures >= MAX_TRANSIENT_FAILURES) {
          circuitState = "OPEN";
          quotaExceededUntil = Date.now() + TRANSIENT_COOLDOWN_MS;
        }
        throw err;
      }
      // Retry transient error at most once with bounded backoff & jitter (~400-600ms)
      await sleep(400 + Math.random() * 200);
    }
  }
  throw lastError;
}

/**
 * Compact formatting for conversation history:
 * Limits to last 4 turns and truncates each turn to 200 chars to minimize prompt tokens.
 */
function formatHistory(history: ChatTurn[]): string {
  return history
    .slice(-4)
    .map(
      (turn) =>
        `${turn.role === "user" ? "Shopper" : "ASK MEHRAÉ"}: ${turn.content.slice(0, 200).trim()}`
    )
    .join("\n");
}

function safeParseJson(raw: string): { message?: unknown; recommendations?: unknown } | null {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * High traffic banner required by MEHRAÉ reliability protocol.
 */
const HIGH_TRAFFIC_BANNER =
  "Our AI Assistant is currently experiencing high traffic. Please try again shortly or explore our featured collection.";

/**
 * Smart Fallback — filter-, budget-, and scope-aware.
 *
 * Rules:
 * 1. If Gemini returns 429 (Rate Limit / Quota) or times out:
 *    DO NOT show generic database product fallback grids for prompt injections,
 *    out-of-scope non-clothing queries, or non-shopping queries.
 *    Return: "Our AI Assistant is currently experiencing high traffic. Please try again shortly or explore our featured collection."
 * 2. For non-clothing items (shoes, handbags, electronics) or prompt injection queries:
 *    DO NOT auto-inject random saree cards unless explicitly relevant.
 *    Return a helpful text response explaining MEHRAÉ's core boutique offerings.
 */
export function createSmartFallback(
  message: string,
  candidates: ProductWithRelations[],
  meta: RetrievalMeta,
  reason: "quota" | "timeout" | "error" | "no_key"
): AskMehraeResult {
  const isInjection = isPromptInjectionQuery(message);
  const outOfScope = detectOutOfScopeQuery(message);
  const isShopping = isProductRelatedQuery(message);
  const isQuotaOrTimeout = reason === "quota" || reason === "timeout";

  // 1. Quota (429) or Timeout on Injections, Out-of-Scope, or Non-Shopping queries
  if (isQuotaOrTimeout) {
    if (
      isInjection ||
      outOfScope.isOutOfScope ||
      !isShopping ||
      meta.matchType === "none" ||
      meta.matchType === "text"
    ) {
      return {
        message: HIGH_TRAFFIC_BANNER,
        recommendations: [],
      };
    }
  }

  // 2. Out-of-Scope non-clothing query handling
  if (outOfScope.isOutOfScope) {
    return {
      message: `MEHRAÉ specializes exclusively in handcrafted Indian luxury womenswear—specifically luxury sarees, bridal & festive lehengas, contemporary gowns, and fine statement jewellery. We do not carry ${outOfScope.category}. Please explore our couture apparel and jewellery collections!`,
      recommendations: [],
    };
  }

  // 3. Prompt injection handling
  if (isInjection) {
    return {
      message:
        "Namaste! I am ASK MEHRAÉ, your personal shopping assistant. I am here exclusively to help you explore and style luxury sarees, lehengas, gowns, and fine jewellery from our collection. How may I assist your wardrobe today?",
      recommendations: [],
    };
  }

  // 4. No candidates at all
  if (candidates.length === 0) {
    if (meta.matchType === "none" && meta.relaxedNote) {
      return { message: meta.relaxedNote, recommendations: [] };
    }
    if (isQuotaOrTimeout) {
      return {
        message: HIGH_TRAFFIC_BANNER,
        recommendations: [],
      };
    }
    if (reason === "no_key") {
      return {
        message:
          "Connect the Gemini API key to enable full conversational styling advice and fashion recommendations.",
        recommendations: [],
      };
    }
    if (!isShopping) {
      return {
        message:
          "MEHRAÉ specializes exclusively in handcrafted Indian luxury womenswear, including luxury sarees, bridal & festive lehengas, contemporary gowns, and fine jewellery. Tell us what occasion, colour, or style you are looking for!",
        recommendations: [],
      };
    }
    return {
      message:
        "I wasn't able to find matching items in our current collection. Try a different colour, category, or browse our full catalogue.",
      recommendations: [],
    };
  }

  // 5. Genuine shopping query with matching candidates
  const topPieces = candidates.slice(0, 3);
  let fallbackMessage = "";

  const relaxedPrefix =
    meta.matchType === "relaxed" && meta.relaxedNote ? meta.relaxedNote + " " : "";

  let budgetContext = "";
  if (meta.requestedMinPrice && meta.requestedMaxPrice) {
    budgetContext = ` between ₹${meta.requestedMinPrice.toLocaleString("en-IN")} and ₹${meta.requestedMaxPrice.toLocaleString("en-IN")}`;
  } else if (meta.requestedMaxPrice) {
    budgetContext = ` under ₹${meta.requestedMaxPrice.toLocaleString("en-IN")}`;
  } else if (meta.requestedMinPrice) {
    budgetContext = ` starting from ₹${meta.requestedMinPrice.toLocaleString("en-IN")}`;
  }

  if (isQuotaOrTimeout) {
    fallbackMessage =
      HIGH_TRAFFIC_BANNER +
      (budgetContext
        ? ` Here are pieces from our collection within your requested budget (${budgetContext.trim()}):`
        : " Here are pieces from our collection tailored to your search:");
  } else if (reason === "no_key") {
    fallbackMessage =
      relaxedPrefix +
      `Here are pieces from our collection matching your search${budgetContext}. Connect the Gemini API key to enable personalized conversational styling advice.`;
  } else {
    fallbackMessage =
      relaxedPrefix +
      `We're currently having trouble reaching the full AI styling assistant, but here are curated pieces from our collection matching your request${budgetContext}.`;
  }

  return {
    message: fallbackMessage,
    recommendations: topPieces.map((product) => ({
      product,
      reason: "Curated piece from the collection matching your search criteria.",
    })),
  };
}

/**
 * The full ASK MEHRAÉ pipeline:
 *   1. Check prompt injection and out-of-scope early.
 *   2. Check bounded in-memory cache with user-scope isolation.
 *   3. Rehydrate cached recommendations against live Supabase data.
 *   4. Retrieve compact candidate set with strict price/attribute filters.
 *   5. If retrieval returned "none", short-circuit immediately.
 *   6. Check circuit breaker state before invoking Gemini.
 *   7. Send context with retrieval metadata to Gemini (gemini-3.8-flash) with 25s timeout.
 *   8. Validate and attach trusted product data, then cache the result.
 */
export async function askMehrae(
  message: string,
  history: ChatTurn[],
  userScope = "anon"
): Promise<AskMehraeResult> {
  // 1. Prompt Injection Early Guard
  if (isPromptInjectionQuery(message)) {
    return {
      message:
        "Namaste! I am ASK MEHRAÉ, your personal shopping assistant. I am here exclusively to help you explore and style luxury sarees, lehengas, gowns, and fine jewellery from our collection. How may I assist your wardrobe today?",
      recommendations: [],
    };
  }

  // 2. Out-of-Scope Non-Clothing Early Guard
  const oos = detectOutOfScopeQuery(message);
  if (oos.isOutOfScope) {
    return {
      message: `MEHRAÉ specializes exclusively in handcrafted Indian luxury womenswear—specifically luxury sarees, bespoke bridal & festive lehengas, contemporary gowns, and fine statement jewellery. We do not carry ${oos.category}. Please explore our couture apparel and jewellery collections!`,
      recommendations: [],
    };
  }

  // 3. In-memory cache check
  const cacheKey = buildAiCacheKey(userScope, message, history);
  const cached = getCachedAiResponse(cacheKey, userScope);

  if (cached) {
    const rehydrated = await rehydrateCachedRecommendations(cached.recommendations);
    return {
      message: cached.message,
      recommendations: rehydrated,
    };
  }

  // 4. Retrieve targeted candidates from Supabase (up to 5 items)
  const { products: candidates, meta } = await retrieveCandidateProducts(message, 5);

  // 5. Zero-result short-circuit
  if (meta.matchType === "none" && candidates.length === 0) {
    // If circuit breaker is open (quota limit exceeded), provide the high traffic banner
    if (!allowGeminiCall()) {
      return {
        message: HIGH_TRAFFIC_BANNER,
        recommendations: [],
      };
    }
    const noneResult: AskMehraeResult = {
      message:
        meta.relaxedNote ||
        "I wasn't able to find any matching items in our current collection. Try a different colour, category, or price range.",
      recommendations: [],
    };
    setCachedAiResponse(cacheKey, noneResult.message, noneResult.recommendations, userScope);
    return noneResult;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return createSmartFallback(message, candidates, meta, "no_key");
  }

  // 6. Circuit breaker check
  if (!allowGeminiCall()) {
    return createSmartFallback(message, candidates, meta, "quota");
  }

  // 7. Token-optimized context with complete retrieval metadata
  const context = candidates.map(toAiContext);
  const contextWithMeta = {
    retrievalInfo: {
      matchType: meta.matchType,
      requestedColor: meta.requestedColor,
      requestedCategory: meta.requestedCategory,
      requestedOccasion: meta.requestedOccasion,
      requestedMinPrice: meta.requestedMinPrice,
      requestedMaxPrice: meta.requestedMaxPrice,
      note: meta.relaxedNote,
    },
    products: context,
  };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.8-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 500,
      temperature: 0.3,
    },
    systemInstruction: ASK_MEHRAE_SYSTEM_PROMPT,
  });

  let raw: string;
  try {
    raw = await generateWithRetry(
      model,
      buildUserTurn(JSON.stringify(contextWithMeta), message, formatHistory(history))
    );
  } catch (err) {
    console.error("Gemini call failed:", err);
    const reason = isQuotaError(err)
      ? "quota"
      : isTimeoutError(err)
      ? "timeout"
      : "error";
    return createSmartFallback(message, candidates, meta, reason);
  }

  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed.message !== "string") {
    return createSmartFallback(message, candidates, meta, "error");
  }

  const candidateIds = new Set(candidates.map((p) => p.id));
  const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

  const recommendations: AskMehraeResult["recommendations"] = [];
  for (const rec of rawRecs) {
    if (
      rec &&
      typeof rec === "object" &&
      "productId" in rec &&
      typeof (rec as { productId: unknown }).productId === "string" &&
      candidateIds.has((rec as { productId: string }).productId)
    ) {
      const product = candidates.find((p) => p.id === (rec as { productId: string }).productId)!;
      const reason =
        "reason" in rec && typeof (rec as { reason: unknown }).reason === "string"
          ? (rec as { reason: string }).reason
          : "A recommended piece from the collection.";
      recommendations.push({ product, reason });
    }
  }

  // 8. Store valid response in bounded cache
  setCachedAiResponse(cacheKey, parsed.message, recommendations, userScope);

  return { message: parsed.message, recommendations };
}

// Helpers for automated test suite
export function _getCircuitStateForTesting(): {
  state: CircuitState;
  quotaExceededUntil: number;
  consecutiveTransientFailures: number;
} {
  return {
    state: circuitState,
    quotaExceededUntil,
    consecutiveTransientFailures,
  };
}

export function _resetCircuitBreakerForTesting(): void {
  circuitState = "CLOSED";
  quotaExceededUntil = 0;
  consecutiveTransientFailures = 0;
}

export function _tripCircuitBreakerForTesting(cooldownMs = 60_000): void {
  circuitState = "OPEN";
  quotaExceededUntil = Date.now() + cooldownMs;
}
