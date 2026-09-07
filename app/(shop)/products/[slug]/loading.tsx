import { Container, Skeleton } from "@/components/ui/primitives";

export default function ProductLoading() {
  return (
    <Container className="py-12">
      <div className="grid lg:grid-cols-2 gap-12">
        <Skeleton className="aspect-[3/4] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </Container>
  );
}
