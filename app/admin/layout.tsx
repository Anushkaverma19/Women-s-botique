import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inventory", label: "Inventory" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: middleware already redirects non-admins away from
  // /admin, but every admin surface re-verifies the role server-side too,
  // since middleware config can change independently of this layout.
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#f4f4f2] font-sans text-[#1a1a1a]">
      <div className="flex">
        <aside className="w-60 shrink-0 min-h-screen bg-[#1a1a1a] text-white/90 px-5 py-6 hidden md:block">
          <Link href="/" className="block font-display text-xl tracking-wide mb-1 text-white">
            MEHRAÉ
          </Link>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-8">Admin Console</p>
          <nav className="space-y-1" aria-label="Admin navigation">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-sm px-3 py-2 rounded hover:bg-white/10 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 pt-6 border-t border-white/10 text-xs text-white/40">
            Signed in as
            <p className="text-white/80 mt-1 truncate">{profile.email}</p>
          </div>
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          {/* The sidebar above is desktop-only (hidden md:block); without
              this, admins on a phone had no way at all to reach Products,
              Orders, or Inventory. Sticky horizontal tab strip, not the
              desktop sidebar shrunk down. */}
          <nav
            aria-label="Admin navigation"
            className="md:hidden sticky top-20 z-20 flex items-center gap-1 overflow-x-auto no-scrollbar bg-[#1a1a1a] text-white/90 px-3 py-2"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 eyebrow px-3 py-2 rounded hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
