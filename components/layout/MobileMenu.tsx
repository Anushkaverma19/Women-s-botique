"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/shop?sort=newest", label: "New Arrivals" },
  { href: "/shop?category=sarees", label: "Sarees" },
  { href: "/shop?category=lehengas", label: "Lehengas" },
  { href: "/shop?category=dresses", label: "Dresses" },
  { href: "/shop?category=jewellery", label: "Jewellery" },
  { href: "/about", label: "About" },
];

export function MobileMenu({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard navigation so the navbar and every other server-rendered piece
    // of the page reliably reflects the cleared session - see the same
    // note in LogoutButton.tsx.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation, see comment above
    window.location.href = "/";
  }

  return (
    <div className="md:hidden">
      <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-1.5 -ml-1.5">
        <Menu size={22} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(85vw,18rem)] bg-ivory shadow-xl p-6 flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <span className="font-display text-2xl">MEHRAÉ</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-1.5 -mr-1.5">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-5" aria-label="Primary">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="font-display text-xl">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="hairline border-t mt-8 pt-6 flex flex-col gap-4">
              {isLoggedIn ? (
                <>
                  <Link href="/account" onClick={() => setOpen(false)} className="eyebrow">
                    My Account
                  </Link>
                  <Link href="/orders" onClick={() => setOpen(false)} className="eyebrow">
                    Orders
                  </Link>
                  {isAdmin ? (
                    <Link href="/admin" onClick={() => setOpen(false)} className="eyebrow">
                      Admin Dashboard
                    </Link>
                  ) : null}
                  <button
                    onClick={handleLogout}
                    disabled={signingOut}
                    className="eyebrow text-left text-burgundy disabled:opacity-50"
                  >
                    {signingOut ? "Logging Out..." : "Log Out"}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="eyebrow">
                    Login
                  </Link>
                  <Link href="/signup" onClick={() => setOpen(false)} className="eyebrow">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
