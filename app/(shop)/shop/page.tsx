import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/primitives";
import { FiltersBar } from "@/components/products/FiltersBar";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/ProductGrid";
import { Pagination } from "@/components/products/Pagination";
import { listProducts, getCategories } from "@/lib/products/queries";
import { productFilterSchema } from "@/lib/validations/schemas";

export const metadata: Metadata = {
  title: "Shop the Collection",
  description: "Browse MEHRAÉ sarees, lehengas, dresses and jewellery.",
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Container className="py-12">
      <div className="mb-10">
        <p className="eyebrow text-gold mb-3">The Collection</p>
        <h1 className="font-display text-4xl sm:text-5xl">Shop MEHRAÉ</h1>
      </div>
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
        <aside>
          <FiltersSidebar />
        </aside>
        <div>
          <Suspense fallback={<ProductGridSkeleton />}>
            <ShopResults searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </Container>
  );
}

async function FiltersSidebar() {
  const categories = await getCategories();
  return <FiltersBar categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />;
}

async function ShopResults({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const parsed = productFilterSchema.safeParse({
    q: raw.q,
    category: raw.category,
    color: raw.color,
    size: raw.size,
    inStock: raw.inStock,
    sort: raw.sort,
    page: raw.page,
  });

  const filters = parsed.success
    ? parsed.data
    : { sort: "featured" as const, page: 1 };

  const { products, total, page, pageCount } = await listProducts(filters);

  return (
    <div>
      <p className="text-sm text-charcoal/50 mb-6" aria-live="polite">
        {total} {total === 1 ? "piece" : "pieces"}
        {filters.q ? ` for "${filters.q}"` : ""}
      </p>
      <ProductGrid products={products} />
      <Pagination page={page} pageCount={pageCount} />
    </div>
  );
}
