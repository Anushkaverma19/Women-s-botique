import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeRedirectPath(rawPath: string | null): string {
  if (!rawPath) return "/account";
  // Must start with exactly one '/', not followed by '/' or '\'
  if (/^\/(?!\/|\\)[a-zA-Z0-9_\-./]*$/.test(rawPath)) {
    return rawPath;
  }
  return "/account";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? searchParams.get("redirectTo");
  const safeNext = sanitizeRedirectPath(rawNext);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Handle email verification links via token_hash (e.g. signup confirmation)
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "recovery" | "invite" | "email_change" | null;
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // If verification or code exchange failed, redirect to login with error parameter
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
