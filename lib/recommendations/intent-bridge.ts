import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface IntentPrediction {
  predicted_sub_category: string;
  matched_category: string;
  confidence: number;
  top_intents?: Array<{
    sub_category: string;
    mehrae_category: string;
    confidence: number;
  }>;
  occasion: string;
  keywords: string[];
  browsing_affinity: Record<string, number>;
}

// In-memory cache for fast repeated predictions (<1ms)
const intentCache = new Map<string, { data: IntentPrediction; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Predicts user intent from search query and/or browsing history by executing
 * the Python fashion intent bridge (scripts/predict_intent.py).
 */
export async function predictSearchIntent(
  query: string = "",
  history: string[] = []
): Promise<IntentPrediction> {
  const cacheKey = `${query.trim().toLowerCase()}::${history.slice(0, 5).join(",")}`;
  const cached = intentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // First, check if microservice daemon is running on port 5005
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600);
    const serviceRes = await fetch("http://127.0.0.1:5005", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, history }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (serviceRes.ok) {
      const data = (await serviceRes.json()) as IntentPrediction;
      intentCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }
  } catch {
    // Microservice not running or timed out; proceed to child_process execution
  }

  // Fallback: direct Python script execution
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "predict_intent.py");
    const args = [
      scriptPath,
      "--query",
      query,
      "--history",
      history.join(","),
    ];

    const { stdout } = await execFileAsync("python", args, {
      cwd: process.cwd(),
      timeout: 4000,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    const parsed = JSON.parse(stdout.trim()) as IntentPrediction;
    intentCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
    return parsed;
  } catch (err) {
    console.warn("Intent prediction bridge warning, falling back to rule-based intent:", err);

    // Resilient fallback if python is unavailable in production/serverless container
    return fallbackIntent(query, history);
  }
}

/**
 * High-precision keyword fallback in case Python environment is absent
 * in isolated serverless environments.
 */
function fallbackIntent(query: string, history: string[]): IntentPrediction {
  const text = `${query} ${history.join(" ")}`.toLowerCase();
  
  let category = "dresses";
  let subCategory = "Dresses";
  let confidence = 0.75;
  let occasion = "festive";

  if (/saree|sari|pallu|zari|mulberry|organza saree|tissue saree|banarasi/.test(text)) {
    category = "sarees";
    subCategory = "Sarees";
    confidence = 0.88;
  } else if (/lehenga|choli|ghagra|bridal lehenga|can-can|kalidar/.test(text)) {
    category = "lehengas";
    subCategory = "Lehengas";
    confidence = 0.88;
  } else if (/jewel|necklace|choker|jhumka|earring|bangle|polki|kundan|matha patti/.test(text)) {
    category = "jewellery";
    subCategory = "Jewellery";
    confidence = 0.90;
  } else if (/kurta|anarkali|sharara|suit|dress|gown|kaftan/.test(text)) {
    category = "dresses";
    subCategory = "Kurtas, Ethnic Sets and Bottoms";
    confidence = 0.85;
  }

  if (/wedding|bridal|bride|shaadi|trousseau/.test(text)) {
    occasion = "bridal";
  } else if (/cocktail|reception|party|evening/.test(text)) {
    occasion = "cocktail";
  }

  return {
    predicted_sub_category: subCategory,
    matched_category: category,
    confidence,
    top_intents: [
      { sub_category: subCategory, mehrae_category: category, confidence }
    ],
    occasion,
    keywords: text.match(/silk|zari|kundan|polki|velvet|organza/g) ?? [],
    browsing_affinity: history.length ? { [category]: 1.0 } : {},
  };
}
