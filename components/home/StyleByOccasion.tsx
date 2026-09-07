"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container, SectionHeading, EmptyState, Skeleton } from "@/components/ui/primitives";
import { formatINR } from "@/lib/utils";
import type { Occasion } from "@/types/database";

const OCCASION_OPTIONS: { value: Occasion; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "festive", label: "Festive" },
  { value: "evening", label: "Evening" },
  { value: "formal", label: "Formal" },
  { value: "gift", label: "Gift" },
  { value: "everyday-luxury", label: "Everyday Luxury" },
];

interface OccasionProduct {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  compareAtPrice: number | null;
  image: string | null;
  inStock: boolean;
}

export function StyleByOccasion() {
  const [active, setActive] = useState<Occasion>("wedding");
  const [products, setProducts] = useState<OccasionProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Set<Occasion>>(new Set());
  const cache = useState<Map<Occasion, OccasionProduct[]>>(() => new Map())[0];

  async function select(occasion: Occasion) {
    setActive(occasion);
    if (cache.has(occasion)) {
      setProducts(cache.get(occasion)!);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/products/occasion?occasion=${occasion}`);
      const data = await res.json();
      const results: OccasionProduct[] = data.products ?? [];
      cache.set(occasion, results);
      setLoaded((prev) => new Set(prev).add(occasion));
      setProducts(results);
    } finally {
      setLoading(false);
    }
  }

  // Fetch the default tab's products on first render (documented
  // fetch-on-mount exception, not a state-synchronization bug).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    select("wedding");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="py-24 bg-parchment/50" aria-labelledby="occasion-heading">
      <Container>
        <SectionHeading eyebrow="Curated by Moment" title="Style by Occasion" />
        <div role="tablist" aria-label="Shop by occasion" className="flex flex-wrap gap-2 mb-10">
          {OCCASION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="tab"
              aria-selected={active === opt.value}
              onClick={() => select(opt.value)}
              className={`eyebrow px-5 py-2.5 border ${
                active === opt.value
                  ? "bg-charcoal text-ivory border-charcoal"
                  : "border-charcoal/25 hover:border-charcoal"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : products.length === 0 && loaded.has(active) ? (
          <EmptyState title="No pieces found for this occasion yet." />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.slug}`} className="group block">
                <div className="relative aspect-[3/4] bg-ivory overflow-hidden">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <p className="font-display text-lg mt-3 group-hover:text-burgundy">{product.name}</p>
                <p className="text-sm">{formatINR(product.basePrice)}</p>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
