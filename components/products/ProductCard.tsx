import Image from "next/image";
import Link from "next/link";
import { formatINR } from "@/lib/utils";
import type { ProductWithRelations } from "@/types/database";

export function ProductCard({ product, priority = false }: { product: ProductWithRelations; priority?: boolean }) {
  const primaryImage = product.images[0];
  const secondaryImage = product.images[1];
  const inStock = product.variants.some((v) => v.active && v.stock_quantity > 0);

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-parchment">
        {primaryImage ? (
          <Image
            src={primaryImage.image_url}
            alt={primaryImage.alt_text || product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : null}
        {secondaryImage ? (
          <Image
            src={secondaryImage.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        ) : null}
        {!inStock ? (
          <span className="absolute top-3 left-3 bg-charcoal text-ivory text-[10px] eyebrow px-2 py-1">
            Sold Out
          </span>
        ) : product.compare_at_price ? (
          <span className="absolute top-3 left-3 bg-burgundy text-ivory text-[10px] eyebrow px-2 py-1">
            Save {Math.round((1 - product.base_price / product.compare_at_price) * 100)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="font-display text-lg leading-tight group-hover:text-burgundy transition-colors">
          {product.name}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-sm">{formatINR(product.base_price)}</p>
          {product.compare_at_price ? (
            <p className="text-xs text-charcoal/40 line-through">{formatINR(product.compare_at_price)}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
