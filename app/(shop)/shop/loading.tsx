import { Container } from "@/components/ui/primitives";
import { ProductGridSkeleton } from "@/components/products/ProductGrid";
import { Skeleton } from "@/components/ui/primitives";

export default function ShopLoading() {
  return (
    <Container className="py-12">
      <Skeleton className="h-10 w-64 mb-10" />
      <ProductGridSkeleton />
    </Container>
  );
}
