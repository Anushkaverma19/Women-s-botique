import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/components/cart/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AskMehraeProvider } from "@/components/ai/AskMehraeProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "MEHRAÉ — Modern Heirlooms, Rooted in India.",
    template: "%s | MEHRAÉ",
  },
  description:
    "MEHRAÉ is a premium Indian fashion boutique - sarees, lehengas, dresses and jewellery blending heritage craft with contemporary luxury.",
  openGraph: {
    title: "MEHRAÉ — Modern Heirlooms, Rooted in India.",
    description:
      "Premium Indian fashion, reimagined. Explore sarees, lehengas, dresses and jewellery, and shop with ASK MEHRAÉ, our AI styling concierge.",
    type: "website",
    siteName: "MEHRAÉ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Self-hosted-CDN Google Fonts via <link>, not next/font/google, so
            the build never depends on network access to fonts.gstatic.com. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased bg-ivory text-charcoal">
        <CartProvider>
          <AskMehraeProvider>
            <Navbar />
            <CartDrawer />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </AskMehraeProvider>
        </CartProvider>
      </body>
    </html>
  );
}
