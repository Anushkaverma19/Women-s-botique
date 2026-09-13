import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ASK_MEHRAE_SYSTEM_PROMPT, buildUserTurn } from "@/lib/ai/systemPrompt";
import { retrieveCandidateProducts, toAiContext } from "@/lib/ai/retrieval";
import type { ProductWithRelations } from "@/types/database";

export interface AskMehraeResult {
  message: string;
  recommendations: {
    product: ProductWithRelations;
    reason: string;
  }[];
}

const FALLBACK_MESSAGE =
  "I couldn't find a piece matching that request in the current collection.";

const QUOTA_FALLBACK_MESSAGE =
  "Our styling assistant is in high demand right now, so I can't add personal notes just yet - but here are real pieces from the collection that match what you asked for.";

const GENERIC_ERROR_FALLBACK_MESSAGE =
  "I'm having trouble reaching the styling assistant right now - here are a few pieces that might suit you.";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Process-local circuit breaker for Gemini quota exhaustion.
 *
 * When Gemini returns a 429/RESOURCE_EXHAUSTED, we already know every other
 * concurrent request in this process is about to hit the same wall - so
 * instead of making each of them pay the latency of a doomed API call (and
 * counting further against the quota once it partially recovers), we short
 * -circuit straight to the catalogue-only fallback for a cooldown window.
 *
 * This is per-instance state, same caveat as the in-memory rate limiter in
 * lib/rate-limit.ts: on a single server it's exactly right, on many
 * serverless instances each instance discovers the outage independently
 * (slightly less efficient, but never incorrect - worst case is a few
 * redundant calls across instances, not a crash).
 */
const QUOTA_COOLDOWN_MS = 30_000;
let quotaExceededUntil = 0;

function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota")
  );
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Transient server-side / network issues are worth a quick retry.
  // Quota errors and 4xx client errors (bad request, invalid key, etc.)
  // are not - retrying them immediately just wastes time and quota.
  return (
    message.includes("500") ||
    message.includes("503") ||
    message.includes("fetch failed") ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("network")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calls Gemini with a couple of short, backed-off retries for transient errors only. */
async function generateWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  prompt: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (isQuotaError(err)) {
        quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
        throw err; // Don't burn further attempts against an exhausted quota.
      }
      if (!isRetryableError(err) || attempt === maxAttempts - 1) {
        throw err;
      }
      // Exponential backoff with jitter: ~300ms, ~700ms.
      await sleep(300 * 2 ** attempt + Math.random() * 100);
    }
  }
  throw lastError;
}

function formatHistory(history: ChatTurn[]): string {
  return history
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? "Shopper" : "ASK MEHRAÉ"}: ${turn.content}`)
    .join("\n");
}

function safeParseJson(raw: string): { message?: unknown; recommendations?: unknown } | null {
  // Gemini is instructed to return raw JSON, but strip code fences
  // defensively in case it wraps the response anyway.
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * The full ASK MEHRAÉ pipeline:
 *   1. Retrieve a grounded candidate set from Supabase (source of truth).
 *   2. Send only that trimmed context + the user's message to Gemini.
 *   3. Parse Gemini's structured JSON response.
 *   4. Validate every recommended productId against the retrieved set -
 *      discard anything Gemini invented.
 *   5. Re-attach full, trusted product data from the candidate set (never
 *      from Gemini's output) before returning to the client.
 */
export async function askMehrae(message: string, history: ChatTurn[]): Promise<AskMehraeResult> {
  const candidates = await retrieveCandidateProducts(message);

  if (candidates.length === 0) {
    return { message: FALLBACK_MESSAGE, recommendations: [] };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Graceful degradation: still useful without an AI key configured -
    // surface the best-matching real products with a generic message
    // rather than failing the whole assistant.
    return {
      message:
        "Here are a few pieces from the collection that could work - connect the Gemini API key to enable full conversational styling advice.",
      recommendations: candidates
        .slice(0, 3)
        .map((product) => ({ product, reason: "A close match for your request." })),
    };
  }

  // Circuit breaker: if we recently learned the Gemini quota is exhausted,
  // skip the doomed network round trip entirely and go straight to the
  // grounded catalogue fallback. This keeps the assistant fast and
  // available under load instead of every request queuing up on a 429.
  if (Date.now() < quotaExceededUntil) {
    return {
      message: QUOTA_FALLBACK_MESSAGE,
      recommendations: candidates
        .slice(0, 3)
        .map((product) => ({ product, reason: "A close match for your request." })),
    };
  }

  const context = candidates.map(toAiContext);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    // NOTE: gemini-2.0-flash was fully shut down by Google on 2026-06-01.
    // gemini-2.5-flash is the current active replacement as of this
    // writing, but it also has a published (non-earlier-than) retirement
    // date of 2026-10-16 - if this project is still running after that,
    // check https://ai.google.dev/gemini-api/docs/deprecations and update
    // this string before assuming the AI assistant is broken.
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: ASK_MEHRAE_SYSTEM_PROMPT,
  });

  let raw: string;
  try {
    raw = await generateWithRetry(
      model,
      buildUserTurn(JSON.stringify(context), message, formatHistory(history))
    );
  } catch (err) {
    console.error("Gemini call failed", err);
    return {
      message: isQuotaError(err) ? QUOTA_FALLBACK_MESSAGE : GENERIC_ERROR_FALLBACK_MESSAGE,
      recommendations: candidates
        .slice(0, 3)
        .map((product) => ({ product, reason: "A close match for your request." })),
    };
  }

  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed.message !== "string") {
    return { message: FALLBACK_MESSAGE, recommendations: [] };
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
    // Any productId not found in candidateIds is silently discarded - this
    // is the no-hallucination enforcement point.
  }

  return { message: parsed.message, recommendations };
}
