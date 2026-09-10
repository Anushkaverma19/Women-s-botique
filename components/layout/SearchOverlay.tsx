"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useOverlayEffects } from "@/lib/hooks/useOverlayEffects";

interface QuickResult {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  image: string | null;
  inStock: boolean;
}

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<QuickResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);
  useOverlayEffects(open, close);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!term || term.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setResults(data.products ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [term]);

  function submitFullSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim()) return;
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(term.trim())}`);
  }

  return (
    <>
      <button aria-label="Search products" onClick={() => setOpen(true)} className="p-1.5">
        <Search size={19} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
          <button aria-label="Close search" className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="relative bg-ivory max-w-2xl mx-auto mt-24 px-6 py-6 shadow-xl">
            <form onSubmit={submitFullSearch} className="flex items-center gap-3 hairline border-b pb-4">
              <Search size={18} className="text-charcoal/50" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search sarees, lehengas, jewellery..."
                className="flex-1 bg-transparent outline-none font-display text-xl"
                aria-label="Search MEHRAÉ"
              />
              <button type="button" aria-label="Close search" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </form>
            <div className="mt-4 min-h-[80px]">
              {loading ? <p className="text-sm text-charcoal/50 py-4">Searching...</p> : null}
              {!loading && term.trim().length >= 2 && results.length === 0 ? (
                <p className="text-sm text-charcoal/50 py-4">No pieces found for this search.</p>
              ) : null}
              <ul className="divide-y divide-charcoal/10">
                {results.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-4 py-3 hover:bg-parchment/60 px-2 -mx-2"
                    >
                      <div className="relative h-14 w-11 bg-parchment shrink-0">
                        {product.image ? (
                          <Image src={product.image} alt={product.name} fill sizes="44px" className="object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{product.name}</p>
                        <p className="text-xs text-charcoal/50">
                          {formatINR(product.basePrice)} {!product.inStock ? "· Out of stock" : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
