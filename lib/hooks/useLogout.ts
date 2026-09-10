"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Single source of truth for "sign the current user out" on the client.
 * Previously this exact sequence was duplicated in LogoutButton.tsx and
 * MobileMenu.tsx - any future change (e.g. clearing client-side cart state)
 * had to be made in two places and would drift. Now both just call this.
 *
 * A hard navigation (not router.push + router.refresh) is used deliberately:
 * Navbar, MobileMenu's auth section, and /account are Server Components
 * that read the session from cookies on the server. A client-router
 * transition immediately after signOut() can race with the browser
 * client's cookie write, or serve an already-cached client-router payload
 * for the destination route, so the page can render with stale
 * (still-logged-in) auth state - a known Supabase SSR + Next.js App Router
 * failure mode that shows up disproportionately on mobile browsers. A full
 * navigation always re-requests the page from the server with the cleared
 * session cookie attached, so every surface (desktop and mobile) reflects
 * the real Supabase auth state.
 */
export function useLogout() {
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation, see comment above
    window.location.href = "/";
  }

  return { logout, signingOut };
}
