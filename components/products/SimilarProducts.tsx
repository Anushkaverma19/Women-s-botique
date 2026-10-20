import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/ui/primitives";
import type { ProductWithRelations } from "@/types/database";

interface SimilarProductsProps {
  products: ProductWithRelations[];
}

export function SimilarProducts({ products }: SimilarProductsProps) {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="mt-24" aria-labelledby="similar-products-heading">
      <SectionHeading
        eyebrow="Curated Catalogue Matches"
        title="Similar Products"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-10">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
