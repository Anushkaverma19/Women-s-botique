"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Only ever uses NEXT_PUBLIC_* env vars. Never import the secret key here.
 * If the env vars are missing (e.g. local dev before Supabase is connected)
 * this throws a clear error instead of silently returning a broken client,
 * so misconfiguration fails loudly during development rather than in
 * production checkout flows.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
    );
  }

  return createBrowserClient(url, key);
}
