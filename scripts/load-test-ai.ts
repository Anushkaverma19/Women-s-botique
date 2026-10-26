/**
 * MEHRAÉ AI Load Test — Mocked Gemini Responses
 *
 * Tests the full AI pipeline (rate-limiting, burst throttle, cache, circuit
 * breaker, fallback) under simulated concurrent load WITHOUT sending real
 * Gemini requests. Safe to run against local / staging environments.
 *
 * Usage:
 *   node --env-file=.env.local --experimental-strip-types scripts/load-test-ai.ts
 */

import crypto from "crypto";
import process from "process";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

function fmt(n: number, unit = "ms") {
  return `${n.toFixed(1)}${unit}`;
}

// ─── Minimal in-process replicas of production modules ────────────────────────

// --- Cache (mirrors lib/ai/cache.ts) ---
interface CachedEntry {
  message: string;
  recommendations: Array<{ productId: string; reason: string }>;
  createdAt: number;
  scope: string;
}

const CACHE_MAX = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;
const cacheMap = new Map<string, CachedEntry>();

function buildCacheKey(scope: string, msg: string): string {
  const raw = `${scope}::${msg.trim().toLowerCase().replace(/\s+/g, " ")}::`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getCache(key: string, scope: string): CachedEntry | null {
  const e = cacheMap.get(key);
  if (!e || e.scope !== scope || Date.now() - e.createdAt > CACHE_TTL_MS) {
    if (e) cacheMap.delete(key);
    return null;
  }
  cacheMap.delete(key);
  cacheMap.set(key, e);
  return e;
}

function setCache(key: string, scope: string, message: string): void {
  if (cacheMap.size >= CACHE_MAX) {
    const oldest = cacheMap.keys().next().value;
    if (oldest) cacheMap.delete(oldest);
  }
  cacheMap.set(key, {
    message,
    recommendations: [],
    createdAt: Date.now(),
    scope,
  });
}

// --- Rate limiter (mirrors lib/rate-limit.ts in-memory path) ---
const rlStore = new Map<string, number[]>();
const AI_LIMIT = 5;
const AI_WINDOW_S = 60;

function checkRateLimit(key: string): { success: boolean; retryAfter: number } {
  const windowMs = AI_WINDOW_S * 1000;
  const now = Date.now();
  const ts = (rlStore.get(key) ?? []).filter((t) => now - t < windowMs);
  ts.push(now);
  rlStore.set(key, ts);
  return { success: ts.length <= AI_LIMIT, retryAfter: AI_WINDOW_S };
}

// --- Burst throttle (mirrors app/api/ai/route.ts) ---
const burstStore = new Map<string, number>();
const MIN_BURST_MS = 2000;

function checkBurst(key: string): boolean {
  const now = Date.now();
  const last = burstStore.get(key);
  if (last && now - last < MIN_BURST_MS) return true;
  burstStore.set(key, now);
  return false;
}

// --- Circuit Breaker (mirrors lib/ai/assistant.ts) ---
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
let circuitState: CircuitState = "CLOSED";
let quotaExceededUntil = 0;
let consecutiveTransientFailures = 0;
const QUOTA_COOLDOWN_MS = 60_000;
const TRANSIENT_COOLDOWN_MS = 30_000;
const MAX_TRANSIENT_FAILURES = 3;

function allowGeminiCall(): boolean {
  if (circuitState === "OPEN") {
    if (Date.now() >= quotaExceededUntil) {
      circuitState = "HALF_OPEN";
      return true;
    }
    return false;
  }
  return true;
}

function recordGeminiSuccess() {
  circuitState = "CLOSED";
  consecutiveTransientFailures = 0;
  quotaExceededUntil = 0;
}

function recordGeminiFailure(isQuota: boolean, isTransient: boolean) {
  if (isQuota) {
    circuitState = "OPEN";
    quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
    return;
  }
  if (isTransient) {
    consecutiveTransientFailures++;
    if (consecutiveTransientFailures >= MAX_TRANSIENT_FAILURES) {
      circuitState = "OPEN";
      quotaExceededUntil = Date.now() + TRANSIENT_COOLDOWN_MS;
    }
  }
}

// --- Mocked Gemini (safe — never sends real HTTP requests) ---
let mockMode: "success" | "quota_429" | "transient_503" = "success";
async function mockGeminiCall(): Promise<string> {
  if (mockMode === "quota_429") throw new Error("[429] RESOURCE_EXHAUSTED: Quota exceeded");
  if (mockMode === "transient_503") throw new Error("[503] Service Unavailable");
  // Simulate realistic Gemini latency: 800-2500ms
  const latencyMs = 800 + Math.random() * 1700;
  await sleep(latencyMs);
  return JSON.stringify({ message: "Here are some beautiful pieces for you.", recommendations: [] });
}

// ─── Simulated pipeline per request ───────────────────────────────────────────

type RequestResult = {
  outcome:
    | "cache_hit"
    | "gemini_success"
    | "rate_limited"
    | "burst_throttled"
    | "circuit_open_fallback"
    | "quota_error_fallback"
    | "transient_error_fallback";
  durationMs: number;
};

async function simulateRequest(userId: string, message: string): Promise<RequestResult> {
  const t0 = Date.now();

  if (checkBurst(userId)) return { outcome: "burst_throttled", durationMs: Date.now() - t0 };
  const { success } = checkRateLimit(`ai:${userId}`);
  if (!success) return { outcome: "rate_limited", durationMs: Date.now() - t0 };

  const cacheKey = buildCacheKey(userId, message);
  if (getCache(cacheKey, userId)) return { outcome: "cache_hit", durationMs: Date.now() - t0 };

  if (!allowGeminiCall()) return { outcome: "circuit_open_fallback", durationMs: Date.now() - t0 };

  try {
    await mockGeminiCall();
    recordGeminiSuccess();
    setCache(cacheKey, userId, "Mock Gemini response");
    return { outcome: "gemini_success", durationMs: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
    const isTransient = msg.includes("503");
    recordGeminiFailure(isQuota, isTransient);
    return {
      outcome: isQuota ? "quota_error_fallback" : "transient_error_fallback",
      durationMs: Date.now() - t0,
    };
  }
}

const MESSAGES = [
  "Show me red bridal lehengas under 40000",
  "Silk saree for wedding reception",
  "Recommend a festive dress for sangeet",
  "I need emerald jewellery for a reception",
  "What formal attire do you have?",
  "Budget silk sarees under 15000",
  "Show me party gowns",
  "Wedding outfit for cocktail event",
];

interface ScenarioResult {
  scenario: string;
  concurrentUsers: number;
  durationMs: number;
  throughput: number;
  outcomes: Record<string, number>;
  latencyMs: { p50: number; p95: number; p99: number; max: number };
  errorRate: number;
  cacheHitRate: number;
  fallbackRate: number;
  memoryMB: { start: number; end: number; delta: number };
  circuitStateAtEnd: CircuitState;
  notes: string[];
}

async function runScenario(
  scenarioName: string,
  concurrentUsers: number,
  options: { uniqueUsersRatio?: number; geminiMode?: typeof mockMode; resetAll?: boolean; note?: string } = {}
): Promise<ScenarioResult> {
  const { uniqueUsersRatio = 1.0, geminiMode = "success", resetAll = true, note = "" } = options;

  mockMode = geminiMode;
  if (resetAll) {
    circuitState = "CLOSED";
    quotaExceededUntil = 0;
    consecutiveTransientFailures = 0;
    cacheMap.clear();
    rlStore.clear();
    burstStore.clear();
  }

  const memStart = process.memoryUsage().heapUsed / 1024 / 1024;
  const t0 = Date.now();
  const notes: string[] = note ? [note] : [];

  const uniqueCount = Math.max(1, Math.floor(concurrentUsers * uniqueUsersRatio));
  const requests = Array.from({ length: concurrentUsers }, (_, i) => {
    const uid = i % uniqueCount;
    return {
      userId: `anon:10.${Math.floor(uid / 256)}.${uid % 256}.1`,
      message: MESSAGES[i % MESSAGES.length]!,
    };
  });

  const results = await Promise.all(requests.map((r) => simulateRequest(r.userId, r.message)));

  const totalDuration = Date.now() - t0;
  const memEnd = process.memoryUsage().heapUsed / 1024 / 1024;

  const outcomes: Record<string, number> = {};
  for (const r of results) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const cacheHits = outcomes["cache_hit"] ?? 0;
  const fallbacks = results.filter((r) => r.outcome.endsWith("_fallback")).length;
  const errors = results.filter(
    (r) => r.outcome === "rate_limited" || r.outcome === "burst_throttled" || r.outcome.endsWith("_fallback")
  ).length;

  if ((outcomes["rate_limited"] ?? 0) > 0)
    notes.push(`⚠ ${outcomes["rate_limited"]} requests rate-limited (in-memory — bypassed across multiple serverless instances)`);
  if ((outcomes["burst_throttled"] ?? 0) > 0)
    notes.push(`⚠ ${outcomes["burst_throttled"]} requests burst-throttled (also in-memory, same multi-instance problem)`);
  if (cacheMap.size >= CACHE_MAX)
    notes.push(`⚠ Cache hit 100-entry LRU cap. Older entries evicted. Cache NOT shared across serverless instances.`);
  if (fallbacks > 0)
    notes.push(`✓ Fallback triggered ${fallbacks}×. Product-catalogue response served gracefully.`);

  return {
    scenario: scenarioName,
    concurrentUsers,
    durationMs: totalDuration,
    throughput: Math.round((concurrentUsers / (totalDuration / 1000)) * 10) / 10,
    outcomes,
    latencyMs: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      max: durations[durations.length - 1] ?? 0,
    },
    errorRate: Math.round((errors / concurrentUsers) * 1000) / 10,
    cacheHitRate: Math.round((cacheHits / concurrentUsers) * 1000) / 10,
    fallbackRate: Math.round((fallbacks / concurrentUsers) * 1000) / 10,
    memoryMB: { start: Math.round(memStart * 10) / 10, end: Math.round(memEnd * 10) / 10, delta: Math.round((memEnd - memStart) * 10) / 10 },
    circuitStateAtEnd: circuitState,
    notes,
  };
}

function printResult(r: ScenarioResult) {
  console.log(`\n${"─".repeat(68)}`);
  console.log(`SCENARIO: ${r.scenario}`);
  console.log(`${"─".repeat(68)}`);
  console.log(`  Users: ${r.concurrentUsers.toLocaleString()}  |  Wall time: ${fmt(r.durationMs)}  |  Throughput: ${r.throughput} req/s`);
  console.log(`  Latency  → p50: ${fmt(r.latencyMs.p50)}  p95: ${fmt(r.latencyMs.p95)}  p99: ${fmt(r.latencyMs.p99)}  max: ${fmt(r.latencyMs.max)}`);
  console.log(`  Error rate: ${r.errorRate}%  |  Cache-hit: ${r.cacheHitRate}%  |  Fallback: ${r.fallbackRate}%`);
  console.log(`  Memory: +${r.memoryMB.delta}MB  (${r.memoryMB.start} → ${r.memoryMB.end} MB)`);
  console.log(`  Circuit state at end: ${r.circuitStateAtEnd}`);
  console.log(`  Outcomes:`);
  for (const [k, v] of Object.entries(r.outcomes))
    console.log(`    ${k.padEnd(36)} ${String(v).padStart(6)}`);
  if (r.notes.length > 0) {
    console.log(`  Notes:`);
    for (const n of r.notes) console.log(`    ${n}`);
  }
}

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("    MEHRAÉ AI — PRODUCTION READINESS LOAD TEST (MOCKED GEMINI)");
  console.log("    NOTE: Zero real Gemini API calls. Latency simulated 800–2500ms.");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const results: ScenarioResult[] = [];

  results.push(await runScenario("A — 100 unique users, happy path", 100, {
    uniqueUsersRatio: 1.0, geminiMode: "success",
    note: "Baseline. All 100 users get a Gemini response. No limits triggered.",
  }));
  printResult(results.at(-1)!);

  results.push(await runScenario("B — 500 users, 20% repeat queries", 500, {
    uniqueUsersRatio: 0.8, geminiMode: "success",
    note: "~20% of requests collide on same user+message → cache hit. LRU eviction starts.",
  }));
  printResult(results.at(-1)!);

  results.push(await runScenario("C — 1,000 users, rate-limit pressure (200 unique IPs)", 1000, {
    uniqueUsersRatio: 0.2, geminiMode: "success",
    note: "200 unique IPs each send ~5 requests/user. Exposes in-memory RL only working per-instance.",
  }));
  printResult(results.at(-1)!);

  results.push(await runScenario("D — 5,000 unique users, happy path", 5000, {
    uniqueUsersRatio: 1.0, geminiMode: "success",
    note: "Stress test. 5000 cache misses. Cache LRU hits 100-entry cap repeatedly.",
  }));
  printResult(results.at(-1)!);

  results.push(await runScenario("E — 5,000 users, Gemini 429 quota exhaustion", 5000, {
    uniqueUsersRatio: 1.0, geminiMode: "quota_429",
    note: "429 from Gemini. First call trips circuit OPEN. All 4999 remaining get immediate fallback.",
  }));
  printResult(results.at(-1)!);

  results.push(await runScenario("F — 5,000 users, Gemini 503 transient errors", 5000, {
    uniqueUsersRatio: 1.0, geminiMode: "transient_503",
    note: "503 transient errors. Circuit trips after 3 failures. Remaining users get fallback.",
  }));
  printResult(results.at(-1)!);

  // Multi-instance race condition demo
  console.log(`\n${"─".repeat(68)}`);
  console.log("SCENARIO G — Multi-Instance In-Memory Bypass Demo");
  console.log(`${"─".repeat(68)}`);
  console.log("  Demonstrates rate-limit bypass: same user hits two 'instances'.");
  console.log("  Instance 1 rate-limiter counts 5 req for user X → blocks.");
  console.log("  Instance 2 has zero count for user X → allows all 5 again.");
  console.log("  Net effect: user can send 5 × N_instances requests (not 5).");
  const sameUser = "anon:1.2.3.4";
  const msg = "Show me red bridal lehengas under 40000";
  // Instance A's store
  const inst1Store = new Map<string, number[]>();
  // Instance B's store (separate)
  const inst2Store = new Map<string, number[]>();

  function checkRLInst(store: Map<string, number[]>, key: string): boolean {
    const windowMs = AI_WINDOW_S * 1000;
    const now = Date.now();
    const ts = (store.get(key) ?? []).filter((t) => now - t < windowMs);
    ts.push(now);
    store.set(key, ts);
    return ts.length <= AI_LIMIT;
  }

  let inst1Allowed = 0, inst1Blocked = 0;
  let inst2Allowed = 0, inst2Blocked = 0;
  for (let i = 0; i < 10; i++) {
    if (checkRLInst(inst1Store, `ai:${sameUser}`)) inst1Allowed++; else inst1Blocked++;
    if (checkRLInst(inst2Store, `ai:${sameUser}`)) inst2Allowed++; else inst2Blocked++;
  }
  console.log(`\n  Same user, 10 requests split across 2 instances:`);
  console.log(`    Instance 1: ${inst1Allowed} allowed, ${inst1Blocked} blocked`);
  console.log(`    Instance 2: ${inst2Allowed} allowed, ${inst2Blocked} blocked`);
  console.log(`    Total requests allowed: ${inst1Allowed + inst2Allowed} (expected 5 with shared Redis)`);
  console.log(`    ⚠ BYPASS: ${inst1Allowed + inst2Allowed - AI_LIMIT} extra requests leaked per N instances\n`);

  // Summary
  console.log(`\n${"═".repeat(68)}`);
  console.log("  SUMMARY");
  console.log(`${"═".repeat(68)}`);
  console.log(`${"Scenario".padEnd(48)} ${"p95".padStart(8)} ${"p99".padStart(8)} ${"Err%".padStart(6)} ${"Fall%".padStart(7)}`);
  console.log(`${"─".repeat(68)}`);
  for (const r of results) {
    console.log(
      `${r.scenario.slice(0, 46).padEnd(48)} ${fmt(r.latencyMs.p95).padStart(8)} ${fmt(r.latencyMs.p99).padStart(8)} ${`${r.errorRate}%`.padStart(6)} ${`${r.fallbackRate}%`.padStart(7)}`
    );
  }
  console.log(`${"═".repeat(68)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
