import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using SUPABASE_SECRET_KEY (service role).
 *
 * `import "server-only"` guarantees a build-time failure if any client
 * component or client-bundled module ever imports this file, so the secret
 * key can never leak into the browser bundle.
 *
 * This client BYPASSES Row Level Security. It must only be used:
 *   - after the caller's role has been verified server-side (see
 *     lib/supabase/require-admin.ts), or
 *   - for well-scoped, deliberately public reads (e.g. AI product grounding,
 *     public catalogue queries) where no user-specific data is touched.
 *
 * Never forward client-supplied filters directly into privileged writes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local (server-side only)."
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
