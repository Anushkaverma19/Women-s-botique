import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

/**
 * Returns the authenticated user's session (via the request cookies) or
 * null. This never trusts anything supplied by the client except the
 * session cookie itself, which Supabase verifies cryptographically.
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Looks up the caller's role directly from the `profiles` table using the
 * privileged admin client - never from a client-supplied header, cookie, or
 * request body field. This is the single source of truth for "is this user
 * an admin".
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Authentication required.") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You do not have permission to do this.") {
    super(message);
  }
}

/**
 * Throws unless the current request is authenticated as an admin.
 * Use at the top of every admin Route Handler / Server Action.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new UnauthorizedError();
  if (profile.role !== "admin") throw new ForbiddenError();
  return profile;
}

/**
 * Throws unless the current request is authenticated as any user.
 * Returns the verified profile.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new UnauthorizedError();
  return profile;
}
