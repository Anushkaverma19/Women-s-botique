import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCartSummary } from "@/lib/cart/queries";
import { handleApiError } from "@/lib/api-response";

/**
 * GET /api/cart
 * Returns the cart summary for the current user.
 * 
 * Production Resiliency & Guest Handling:
 * - Awaits `cookies()` for Next.js 15+ / 16 async cookie store compatibility.
 * - Manages chunked auth cookies with `getAll` and `setAll`.
 * - If the visitor is a guest (not authenticated), gracefully returns an empty cart
 *   with HTTP 200 instead of throwing 401 Unauthorized to prevent console or redirect errors.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { items: [], total: 0, count: 0, subtotal: 0, itemCount: 0 },
        { status: 200 }
      );
    }

    const supabase = createServerClient(url, key, {
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
            // Can be safely ignored if called in a read-only or Server Component context
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Guest Handling: If user is not authenticated, DO NOT return 401 Unauthorized.
    // Gracefully return empty cart with HTTP 200 so guest users never trigger errors.
    if (authError || !user) {
      return NextResponse.json(
        { items: [], total: 0, count: 0, subtotal: 0, itemCount: 0 },
        { status: 200 }
      );
    }

    const summary = await getCartSummary(user.id);
    return NextResponse.json({
      ...summary,
      total: summary.subtotal,
      count: summary.itemCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
