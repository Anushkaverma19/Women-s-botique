// tests/rate-limit-upstash.test.ts
import { rateLimit } from "../lib/rate-limit";

describe("Upstash shared rate limiter simulation", () => {
  const mockStore: Record<string, number> = {};
  const originalFetch = global.fetch as typeof fetch;
  const mockFetch = jest.fn<Promise<Response>, [string, RequestInit]>(async (url, init) => {
    const body = JSON.parse(init?.body as string);
    const [, key] = body[0];
    mockStore[key] = (mockStore[key] ?? 0) + 1;
    return {
      ok: true,
      json: async () => [{ result: { result: mockStore[key] } }],
    } as unknown as Response;
  });

  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-upstash.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
  });

  afterAll(() => {
    global.fetch = originalFetch as typeof fetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  test("counter increments across calls", async () => {
    const key = "test-user";
    const limit = 5;
    const windowSeconds = 60;
    const res1 = await rateLimit(key, limit, windowSeconds);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(limit - 1);
    const res2 = await rateLimit(key, limit, windowSeconds);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(limit - 2);
    for (let i = 0; i < 3; i++) {
      await rateLimit(key, limit, windowSeconds);
    }
    const resFinal = await rateLimit(key, limit, windowSeconds);
    expect(resFinal.success).toBe(false);
    expect(resFinal.remaining).toBe(0);
  });
});
