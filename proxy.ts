import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const PROTECTED_PREFIXES = ["/account", "/orders", "/checkout", "/admin"];

// General ceiling for all API routes, applied here so every route handler
// gets baseline abuse/DoS protection without each one wiring it up
// individually. /api/ai has its own additional, tighter limit (see
// app/api/ai/route.ts) since it's the one backed by a metered third-party
// API - this general limit exists for the rest (cart, checkout, search,
// admin writes, etc.) so a single client can't hammer the database at the
// expense of the ~10k other concurrent shoppers.
const API_LIMIT = 60;
const API_WINDOW_SECONDS = 60;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const { success, retryAfter } = await rateLimit(`api:${ip}`, API_LIMIT, API_WINDOW_SECONDS);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase isn't configured yet, don't hard-crash every request -
  // let pages render and surface a clear configuration error themselves.
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Admin section: confirm the actual role, server-side, via the profiles
  // table - a valid session alone is not enough to enter /admin.
  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|mp4|webp)$).*)",
  ],
};
