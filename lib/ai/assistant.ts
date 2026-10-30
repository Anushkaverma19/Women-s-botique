import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ASK_MEHRAE_SYSTEM_PROMPT, buildUserTurn } from "@/lib/ai/systemPrompt";
import {
  retrieveCandidateProducts,
  toAiContext,
  isProductRelatedQuery,
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
    message.toLowerCase().includes("timed out") ||
    message.toLowerCase().includes("abort") ||
    message.toLowerCase().includes("aborted") ||
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
 * Smart Fallback — filter- and budget-aware.
 *
 * When the retrieval returned relaxed/no results, the `meta.relaxedNote` already
 * contains a human-friendly explanation of what was searched and why exact matches
 * weren't found. The fallback message incorporates this so the user sees honest,
 * context-specific messaging instead of generic fallback templates.
 */
function createSmartFallback(
  message: string,
  candidates: ProductWithRelations[],
  meta: RetrievalMeta,
  reason: "quota" | "error" | "no_key"
): AskMehraeResult {
  const isShopping = isProductRelatedQuery(message);

  // --- No candidates at all ---
  if (candidates.length === 0) {
    if (meta.matchType === "none" && meta.relaxedNote) {
      return { message: meta.relaxedNote, recommendations: [] };
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
          "Our AI styling assistant is currently unavailable due to high demand. Please try asking again shortly, or explore our collections.",
        recommendations: [],
      };
    }
    return {
      message:
        "I wasn't able to find matching items in our current collection. Try a different colour, category, or browse our full catalogue.",
      recommendations: [],
    };
  }

  // --- We have candidates (exact or relaxed matches) ---
  const topPieces = candidates.slice(0, 3);
  let fallbackMessage = "";

  // If results were relaxed, lead with the relaxation note
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

  if (reason === "no_key") {
    fallbackMessage =
      relaxedPrefix +
      `Here are pieces from our collection matching your search${budgetContext}. Connect the Gemini API key to enable personalized conversational styling advice.`;
  } else if (reason === "quota") {
    fallbackMessage =
      relaxedPrefix +
      `Our conversational styling assistant is temporarily taking a breather due to high demand, but here are real pieces from our collection tailored to your search${budgetContext}.`;
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
 *   1. Check bounded in-memory cache with user-scope isolation.
 *   2. Rehydrate cached recommendations against live Supabase data.
 *   3. Retrieve compact candidate set from Supabase with strict price and attribute filters.
 *   4. If retrieval returned "none" (e.g. price out of range or no matches), short-circuit immediately.
 *   5. Check circuit breaker state before invoking Gemini.
 *   6. Send context with retrieval metadata to Gemini (gemini-3.8-flash) with 25s timeout.
 *   7. Validate and attach trusted product data, then cache the result.
 */
export async function askMehrae(
  message: string,
  history: ChatTurn[],
  userScope = "anon"
): Promise<AskMehraeResult> {
  // 1. In-memory cache check
  const cacheKey = buildAiCacheKey(userScope, message, history);
  const cached = getCachedAiResponse(cacheKey, userScope);

  if (cached) {
    // Rehydrate recommendations against live Supabase catalogue
    const rehydrated = await rehydrateCachedRecommendations(cached.recommendations);
    return {
      message: cached.message,
      recommendations: rehydrated,
    };
  }

  // 2. Retrieve targeted candidates from Supabase (up to 5 items) with strict price/attribute filters
  const { products: candidates, meta } = await retrieveCandidateProducts(message, 5);

  // 3. Zero-result short-circuit: if the user asked for a budget or specific item and we found nothing,
  //    return immediately with the explicit message — do NOT burn a Gemini call.
  if (meta.matchType === "none" && candidates.length === 0) {
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

  // 4. Circuit breaker check
  if (!allowGeminiCall()) {
    return createSmartFallback(message, candidates, meta, "quota");
  }

  // 5. Token-optimized context with complete retrieval metadata
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
    return createSmartFallback(
      message,
      candidates,
      meta,
      isQuotaError(err) ? "quota" : "error"
    );
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

  // 6. Store valid response in bounded cache
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
