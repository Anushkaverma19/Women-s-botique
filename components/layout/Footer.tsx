import { Container } from "@/components/ui/primitives";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-charcoal text-ivory mt-24">
      <Container className="py-16 grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <p className="font-display text-3xl mb-3">MEHRAÉ</p>
          <p className="text-ivory/60 text-sm max-w-xs">Modern Heirlooms, Rooted in India.</p>
        </div>
        <FooterColumn
          title="Shop"
          links={[
            { href: "/shop?category=sarees", label: "Sarees" },
            { href: "/shop?category=lehengas", label: "Lehengas" },
            { href: "/shop?category=dresses", label: "Dresses" },
            { href: "/shop?category=jewellery", label: "Jewellery" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { href: "/account", label: "Account" },
            { href: "/orders", label: "Orders" },
            { href: "/about", label: "About" },
            { href: "/contact", label: "Contact" },
          ]}
        />
        <div>
          <p className="eyebrow text-ivory/50 mb-4">Newsletter</p>
          <NewsletterForm />
        </div>
      </Container>
      <div className="border-t border-ivory/10">
        <Container className="py-6 flex flex-col sm:flex-row gap-3 justify-between text-xs text-ivory/50">
          <p>© {new Date().getFullYear()} MEHRAÉ. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-ivory">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ivory">
              Terms
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="eyebrow text-ivory/50 mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm text-ivory/80">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-ivory">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
