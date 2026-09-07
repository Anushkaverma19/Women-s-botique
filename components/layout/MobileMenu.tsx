"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

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

  return (
    <div className="md:hidden">
      <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-1.5">
        <Menu size={22} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-ivory shadow-xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <span className="font-display text-2xl">MEHRAÉ</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-5">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="font-display text-xl">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="hairline border-t mt-8 pt-6 flex flex-col gap-4">
              <Link href={isLoggedIn ? "/account" : "/login"} onClick={() => setOpen(false)} className="eyebrow">
                {isLoggedIn ? "My Account" : "Login / Sign Up"}
              </Link>
              <Link href="/orders" onClick={() => setOpen(false)} className="eyebrow">
                Orders
              </Link>
              {isAdmin ? (
                <Link href="/admin" onClick={() => setOpen(false)} className="eyebrow">
                  Admin Dashboard
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
