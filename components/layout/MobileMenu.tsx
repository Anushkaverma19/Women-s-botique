"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useLogout } from "@/lib/hooks/useLogout";
import { useOverlayEffects } from "@/lib/hooks/useOverlayEffects";

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
  const { logout, signingOut } = useLogout();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOverlayEffects(open, close);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div className="md:hidden">
      <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-1.5 -ml-1.5">
        <Menu size={22} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-charcoal/40" onClick={close} />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="absolute right-0 top-0 h-full w-[min(85vw,18rem)] max-w-full bg-ivory shadow-xl p-6 flex flex-col overflow-y-auto overscroll-contain"
          >
            <div className="flex justify-between items-center mb-8">
              <span className="font-display text-2xl">MEHRAÉ</span>
              <button aria-label="Close menu" onClick={close} className="p-1.5 -mr-1.5">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-5" aria-label="Primary">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={close} className="font-display text-xl">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="hairline border-t mt-8 pt-6 flex flex-col gap-4">
              {isLoggedIn ? (
                <>
                  <Link href="/account" onClick={close} className="eyebrow">
                    My Account
                  </Link>
                  <Link href="/orders" onClick={close} className="eyebrow">
                    Orders
                  </Link>
                  {isAdmin ? (
                    <Link href="/admin" onClick={close} className="eyebrow">
                      Admin Dashboard
                    </Link>
                  ) : null}
                  <button
                    onClick={logout}
                    disabled={signingOut}
                    className="eyebrow text-left text-burgundy disabled:opacity-50"
                  >
                    {signingOut ? "Logging Out..." : "Log Out"}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={close} className="eyebrow">
                    Login
                  </Link>
                  <Link href="/signup" onClick={close} className="eyebrow">
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
