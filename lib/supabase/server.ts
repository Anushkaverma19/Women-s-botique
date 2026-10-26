import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client for use inside Server Components, Server
 * Actions, and Route Handlers.
 *
 * Configured for Next.js 15+ / 16:
 * - Awaits `cookies()` asynchronously.
 * - Uses `getAll` and `setAll` for robust chunked auth cookie support across Vercel deployments.
 * - Wraps `setAll` in a try/catch so invocations within Server Components (where cookie writing
 *   is disallowed) fail safely without crashing rendering.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Standard Supabase variable is ANON_KEY, checking both for safety:
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component or read-only context.
          // This is expected and safe to ignore when middleware/proxy manages session refresh.
        }
      },
    },
  });
}