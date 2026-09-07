import Link from "next/link";
import { User } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { BagButton } from "@/components/cart/BagButton";

const LINKS = [
  { href: "/shop?sort=newest", label: "New Arrivals" },
  { href: "/shop?category=sarees", label: "Sarees" },
  { href: "/shop?category=lehengas", label: "Lehengas" },
  { href: "/shop?category=dresses", label: "Dresses" },
  { href: "/shop?category=jewellery", label: "Jewellery" },
  { href: "/about", label: "About" },
];

export async function Navbar() {
  const profile = await getCurrentProfile();
  const isLoggedIn = Boolean(profile);
  const isAdmin = profile?.role === "admin";

  return (
    <header className="sticky top-0 z-30 bg-ivory/95 backdrop-blur border-b border-charcoal/10">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <MobileMenu isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
          <Link href="/" className="font-display text-2xl sm:text-3xl tracking-wide">
            MEHRAÉ
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 eyebrow text-charcoal/80" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-burgundy">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <SearchOverlay />
          <Link
            href={isLoggedIn ? "/account" : "/login"}
            aria-label={isLoggedIn ? "My account" : "Login"}
            className="p-1.5 hidden sm:inline-flex"
          >
            <User size={19} />
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="hidden lg:inline eyebrow hover:text-burgundy">
              Admin
            </Link>
          ) : null}
          <BagButton />
        </div>
      </div>
    </header>
  );
}
