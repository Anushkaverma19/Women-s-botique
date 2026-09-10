"use client";

import { useLogout } from "@/lib/hooks/useLogout";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const { logout, signingOut } = useLogout();

  return (
    <Button variant="outline" onClick={logout} disabled={signingOut}>
      {signingOut ? "Logging Out..." : "Log Out"}
    </Button>
  );
}
