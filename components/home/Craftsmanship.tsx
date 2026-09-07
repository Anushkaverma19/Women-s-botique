import Image from "next/image";
import { Container, SectionHeading } from "@/components/ui/primitives";

const PANELS = [
  {
    image: "/products/aafreen-bridal-jewellery-set.jpg",
    title: "Kundan & Zardozi",
    copy: "Hand-set stones and metal-thread embroidery, worked panel by panel by artisans trained in techniques passed down through generations.",
  },
  {
    image: "/products/kavya-emerald-festive-lehenga.jpg",
    title: "Heirloom Weaves",
    copy: "Silks sourced from India's weaving belts, chosen for how they fall and move - never for print alone.",
  },
  {
    image: "/products/aria-black-one-shoulder-dress.jpg",
    title: "Contemporary Cut",
    copy: "Traditional textiles reconstructed into silhouettes built for the way modern life actually moves.",
  },
];

export function Craftsmanship() {
  return (
    <section className="py-24" aria-labelledby="craft-heading">
      <Container>
        <SectionHeading eyebrow="Behind Every Piece" title="Craftsmanship" />
        <div className="grid md:grid-cols-3 gap-8">
          {PANELS.map((panel) => (
            <div key={panel.title}>
              <div className="relative aspect-[4/5] mb-5 overflow-hidden">
                <Image
                  src={panel.image}
                  alt={panel.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <h3 className="font-display text-2xl mb-2">{panel.title}</h3>
              <p className="text-sm text-charcoal/60 leading-relaxed">{panel.copy}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
