import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { EditorialIntro } from "@/components/home/EditorialIntro";
import { SecondCinematic } from "@/components/home/SecondCinematic";
import { FeaturedCollection } from "@/components/home/FeaturedCollection";
import { StyleByOccasion } from "@/components/home/StyleByOccasion";
import { Craftsmanship } from "@/components/home/Craftsmanship";
import { AiConciergeSection } from "@/components/home/AiConciergeSection";
import { ProductGridSkeleton } from "@/components/products/ProductGrid";
import { Container } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <>
      <Hero />
      <EditorialIntro />
      <SecondCinematic />
      <Suspense
        fallback={
          <Container className="py-24">
            <ProductGridSkeleton />
          </Container>
        }
      >
        <FeaturedCollection />
      </Suspense>
      <StyleByOccasion />
      <Craftsmanship />
      <AiConciergeSection />
    </>
  );
}
