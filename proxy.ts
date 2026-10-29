import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const PROTECTED_PREFIXES = ["/account", "/orders", "/checkout", "/admin"];

// Route-specific rate limit configurations
const LIMITS = {
  auth: { limit: 10, windowSeconds: 60 },
  checkout: { limit: 15, windowSeconds: 60 },
  apiDefault: { limit: 60, windowSeconds: 60 },
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const isWebhook = pathname.startsWith("/api/webhooks/");
  const isApi = pathname.startsWith("/api/") && !isWebhook;
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  // Tiered rate limiting for API routes & Server Actions
  if (isApi || isServerAction) {
    try {
      const ip = getClientIp(request);
      let tier = LIMITS.apiDefault;
      let bucketPrefix = isServerAction ? "action" : "api";

      if (
        pathname.startsWith("/auth") ||
        pathname.includes("/login") ||
        pathname.includes("/signup")
      ) {
        tier = LIMITS.auth;
        bucketPrefix = "auth";
      } else if (
        pathname.startsWith("/api/razorpay/") ||
        pathname.startsWith("/api/checkout")
      ) {
        tier = LIMITS.checkout;
        bucketPrefix = "checkout";
      }

      const { success, retryAfter } = await rateLimit(
        `${bucketPrefix}:${ip}`,
        tier.limit,
        tier.windowSeconds
      );

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down and try again shortly." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(tier.limit),
            },
          }
        );
      }
    } catch (err) {
      // Fail-open: Never disrupt traffic on rate limiter network drop
      console.warn("[Proxy] Rate limiter check error, failing open:", err);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: options?.httpOnly ?? true,
              sameSite: options?.sameSite ?? "lax",
              secure: process.env.NODE_ENV === "production",
            })
          );
        } catch {
          // Fallback try-catch ensures cookie operations in Edge Middleware/proxy never crash requests
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", path);
    const redirectRes = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c.name, c.value));
    return redirectRes;
  }

  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      const homeRedirectUrl = request.nextUrl.clone();
      homeRedirectUrl.pathname = "/";
      homeRedirectUrl.search = "";
      const homeRedirect = NextResponse.redirect(homeRedirectUrl);
      response.cookies.getAll().forEach((c) => homeRedirect.cookies.set(c.name, c.value));
      return homeRedirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|mp4|webp)$).*)",
  ],
};