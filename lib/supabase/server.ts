import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client for use inside Server Components, Server
 * Actions, and Route Handlers. Bound to the request's auth cookies, so all
 * queries run AS the logged-in user and are subject to Row Level Security.
 *
 * Use this for anything that should respect "customers can only see their
 * own data" - carts, orders, profile. For privileged operations (admin
 * writes, inventory RPCs, AI product retrieval) use lib/supabase/admin.ts
 * instead, and enforce authorization explicitly in code.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
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
          // Called from a Server Component that can't set cookies - safe to
          // ignore because middleware refreshes the session on navigation.
        }
      },
    },
  });
}
