"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        // Hard navigation - see the same note in login/signup: Navbar reads
        // the session server-side, and a client-router transition can serve
        // a stale (still-logged-in) cached payload instead of picking up
        // the cleared session, particularly on mobile browsers.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation, see comment above
        window.location.href = "/";
      }}
    >
      Log Out
    </Button>
  );
}
