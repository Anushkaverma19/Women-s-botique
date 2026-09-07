import { Container, SectionHeading } from "@/components/ui/primitives";
import { ProductGrid } from "@/components/products/ProductGrid";
import { LinkButton } from "@/components/ui/button";
import { getFeaturedProducts } from "@/lib/products/queries";

export async function FeaturedCollection() {
  const products = await getFeaturedProducts(8);

  return (
    <section className="py-24" aria-labelledby="featured-heading">
      <Container>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <SectionHeading eyebrow="Curated For You" title="Featured Collection" />
          <LinkButton href="/shop?sort=featured" variant="outline" className="mb-10">
            View All
          </LinkButton>
        </div>
        <ProductGrid products={products} />
      </Container>
    </section>
  );
}
