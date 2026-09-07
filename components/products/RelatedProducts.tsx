import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/ui/primitives";
import type { ProductWithRelations } from "@/types/database";

export function RelatedProducts({ products }: { products: ProductWithRelations[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mt-24" aria-labelledby="related-heading">
      <SectionHeading eyebrow="You May Also Like" title="Complete the Look" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
