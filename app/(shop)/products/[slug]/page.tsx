import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/products/queries";
import { Container } from "@/components/ui/primitives";
import { ProductGallery } from "@/components/products/ProductGallery";
import { AddToBagForm } from "@/components/products/AddToBagForm";
import { RelatedProducts } from "@/components/products/RelatedProducts";
import { StylingSuggestionButton } from "@/components/ai/StylingSuggestionButton";
import { formatINR } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.short_description,
    openGraph: {
      title: product.name,
      description: product.short_description,
      images: product.images[0] ? [{ url: product.images[0].image_url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const inStock = product.variants.some((v) => v.active && v.stock_quantity > 0);

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="text-xs text-charcoal/50 mb-8">
        <a href="/shop" className="hover:text-charcoal">
          Shop
        </a>
        {product.category ? (
          <>
            {" / "}
            <a href={`/shop?category=${product.category.slug}`} className="hover:text-charcoal">
              {product.category.name}
            </a>
          </>
        ) : null}
        {" / "}
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="lg:sticky lg:top-28 self-start">
          <h1 className="font-display text-3xl sm:text-4xl mb-2">{product.name}</h1>
          <div className="flex items-baseline gap-3 mb-6">
            <p className="text-lg">{formatINR(product.base_price)}</p>
            {product.compare_at_price ? (
              <p className="text-sm text-charcoal/40 line-through">{formatINR(product.compare_at_price)}</p>
            ) : null}
            {!inStock ? <span className="text-xs eyebrow text-burgundy">Sold Out</span> : null}
          </div>

          <p className="text-charcoal/70 leading-relaxed mb-8">{product.description}</p>

          <div className="hairline border-t pt-6 mb-8">
            <AddToBagForm variants={product.variants} />
          </div>

          <div className="hairline border-t pt-6 space-y-2 text-sm text-charcoal/70">
            <p>
              <span className="text-charcoal font-medium">Material: </span>
              {product.material}
            </p>
            <p>
              <span className="text-charcoal font-medium">Care: </span>
              {product.care}
            </p>
          </div>

          <div className="mt-8">
            <StylingSuggestionButton productName={product.name} />
          </div>
        </div>
      </div>

      <RelatedProducts products={related} />
    </Container>
  );
}
