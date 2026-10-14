import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const PROTECTED_PREFIXES = ["/account", "/orders", "/checkout", "/admin"];

const API_LIMIT = 60;
const API_WINDOW_SECONDS = 60;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (request.nextUrl.pathname.startsWith("/api/") && !request.nextUrl.pathname.startsWith("/api/webhooks/")) {
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
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
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
    const redirectRes = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c.name, c.value, c));
    return redirectRes;
  }

  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      const homeRedirect = NextResponse.redirect(new URL("/", request.url));
      response.cookies.getAll().forEach((c) => homeRedirect.cookies.set(c.name, c.value, c));
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