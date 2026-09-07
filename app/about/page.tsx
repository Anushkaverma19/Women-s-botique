import Image from "next/image";
import { Container } from "@/components/ui/primitives";

export const metadata = { title: "About MEHRAÉ" };

export default function AboutPage() {
  return (
    <Container className="py-16 max-w-4xl">
      <p className="eyebrow text-gold mb-4">Our Story</p>
      <h1 className="font-display text-5xl mb-8">Meet MEHRAÉ</h1>
      <div className="relative aspect-[16/9] mb-10">
        <Image
          src="/products/gul-magenta-draped-saree.jpg"
          alt="MEHRAÉ craftsmanship"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="prose-none space-y-5 text-charcoal/70 leading-relaxed max-w-2xl">
        <p>
          MEHRAÉ was founded on a simple belief: that Indian textile heritage deserves a contemporary home. We
          work with artisans across India&apos;s weaving and embroidery traditions to build a wardrobe of modern
          heirlooms - sarees, lehengas, dresses and jewellery designed to be worn for decades, not seasons.
        </p>
        <p>
          Every piece in the collection is chosen for the story in its craft: a hand-set kundan stone, a
          Kanjivaram-style weave, a zardozi border stitched over days rather than hours. We pair that craft with
          silhouettes cut for how women actually move today - at weddings, at work, and everywhere in between.
        </p>
        <p>
          Our styling concierge, ASK MEHRAÉ, extends that same personal attention online - helping you find the
          right piece for your occasion from our real, in-stock collection.
        </p>
      </div>
    </Container>
  );
}
