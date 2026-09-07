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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
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

  const context = candidates.map(toAiContext);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: ASK_MEHRAE_SYSTEM_PROMPT,
  });

  let raw: string;
  try {
    const result = await model.generateContent(
      buildUserTurn(JSON.stringify(context), message, formatHistory(history))
    );
    raw = result.response.text();
  } catch (err) {
    console.error("Gemini call failed", err);
    return {
      message:
        "I'm having trouble reaching the styling assistant right now - here are a few pieces that might suit you.",
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
