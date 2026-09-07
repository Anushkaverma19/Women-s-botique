import { ProductCard } from "@/components/products/ProductCard";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import type { ProductWithRelations } from "@/types/database";

export function ProductGrid({ products }: { products: ProductWithRelations[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No pieces found for this search."
        description="Try adjusting your filters, or explore the full collection."
        action={<LinkButton href="/shop" variant="outline">View All Pieces</LinkButton>}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-4 w-3/4 mt-3" />
          <Skeleton className="h-4 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}
